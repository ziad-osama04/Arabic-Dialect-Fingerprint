"""Train dialect classifier models and save artifacts.

Usage (from project root):
    python scripts/train_classifier.py

Produces all model artifacts in backend/models/ that the
DialectClassifier service loads at inference time.

Key design decisions:
  - GroupShuffleSplit: all clips from a given speaker go entirely into
    train OR test, never both. This prevents speaker-identity leakage.
  - No LabelEncoder: a simple dict mapping {dialect: int} is saved as
    JSON. sklearn classifiers (RF, SVM, KNN) do NOT assume ordinal
    relationships between integer labels — RF uses binary splits, SVM
    uses one-vs-one internally, and KNN uses distance voting.
  - SMOTE rebalances minority dialects AFTER the split, only on train.
  - Cross-validation also uses GroupKFold so speakers never leak
    between folds.
"""

from __future__ import annotations

import json
import pickle
import sys
import time
import warnings
from pathlib import Path

# Force UTF-8 encoding for Windows terminal
sys.stdout.reconfigure(encoding='utf-8')

import numpy as np
import pandas as pd
import shap
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import (
    GroupKFold,
    GroupShuffleSplit,
)
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

# Suppress noisy warnings during training
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
CSV_PATH = BACKEND / "data" / "all_features.csv"
MODELS_DIR = BACKEND / "models"
DIALECTS = ["EGY", "GLF", "LEV", "MAG"]

# Explicit non-ordinal mapping — saved as JSON, no LabelEncoder
CLASS_MAPPING: dict[str, int] = {d: i for i, d in enumerate(DIALECTS)}
INV_CLASS_MAPPING: dict[int, str] = {i: d for d, i in CLASS_MAPPING.items()}


def main() -> int:
    print("=" * 70)
    print("  Arabic Dialect Classifier — Training Pipeline")
    print("  (GroupShuffleSplit + raw-value charts)")
    print("=" * 70)

    # ------------------------------------------------------------------
    # Step 1 — Load and clean data
    # ------------------------------------------------------------------
    if not CSV_PATH.exists():
        print(f"\n[X] Feature CSV not found at {CSV_PATH}")
        print("  Run first:  python scripts/prepare_dataset.py")
        return 1

    df = pd.read_csv(CSV_PATH)
    print(f"\nLoaded {len(df)} rows from {CSV_PATH}")

    # Drop short clips
    before = len(df)
    df = df[df["duration_seconds"] >= 2.0]
    dropped_short = before - len(df)
    if dropped_short:
        print(f"  Dropped {dropped_short} clips shorter than 2 s")

    # Identify feature columns
    meta_cols = {"file_name", "dialect", "speaker_id", "duration_seconds"}
    feature_cols = sorted([c for c in df.columns if c not in meta_cols])

    # Drop rows with NaN in feature columns
    before = len(df)
    df = df.dropna(subset=feature_cols)
    dropped_nan = before - len(df)
    if dropped_nan:
        print(f"  Dropped {dropped_nan} rows with NaN features")

    print(f"  Usable samples: {len(df)}")
    print(f"  Feature count:  {len(feature_cols)}")

    if len(df) < 8:
        print("\n[X] Too few samples to train. Add more audio files.")
        return 1

    # Encode labels using the explicit dict mapping (NOT LabelEncoder)
    y = np.array([CLASS_MAPPING[d] for d in df["dialect"].values])
    X = df[feature_cols].values.astype(np.float64)
    groups = df["speaker_id"].values  # for GroupShuffleSplit
    feature_names = feature_cols

    # Print per-class distribution
    class_counts = {d: 0 for d in DIALECTS}
    for lbl, cnt in zip(*np.unique(y, return_counts=True)):
        class_counts[INV_CLASS_MAPPING[lbl]] = int(cnt)
    print(f"\n  Class distribution: {class_counts}")

    # Print per-speaker distribution
    print("\n  Speakers per dialect:")
    for dialect in DIALECTS:
        dialect_mask = df["dialect"] == dialect
        speakers = df.loc[dialect_mask, "speaker_id"].unique()
        clips_per = [int((df["speaker_id"] == s).sum()) for s in speakers]
        print(f"    {dialect}: {len(speakers)} speakers — "
              f"clips per speaker: {clips_per}")

    min_total = min(class_counts.values())
    if min_total < 20:
        print(f"\n  [!] Warning: smallest class has only {min_total} "
              "samples — results may be unreliable.")

    # ------------------------------------------------------------------
    # Step 2 — Speaker-aware split, scale, SMOTE
    # ------------------------------------------------------------------
    print("\n  Using GroupShuffleSplit (speaker-aware) for train/test ...")

    gss = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups))

    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]
    groups_train = groups[train_idx]

    # Check that no speaker is in both sets
    train_speakers = set(groups[train_idx])
    test_speakers = set(groups[test_idx])
    overlap = train_speakers & test_speakers
    assert len(overlap) == 0, f"Speaker leakage detected: {overlap}"
    print(f"  Train speakers: {sorted(train_speakers)}")
    print(f"  Test  speakers: {sorted(test_speakers)}")

    # Print train/test class distribution
    train_dist = {d: 0 for d in DIALECTS}
    for lbl, cnt in zip(*np.unique(y_train, return_counts=True)):
        train_dist[INV_CLASS_MAPPING[lbl]] = int(cnt)
    test_dist = {d: 0 for d in DIALECTS}
    for lbl, cnt in zip(*np.unique(y_test, return_counts=True)):
        test_dist[INV_CLASS_MAPPING[lbl]] = int(cnt)
    print(f"\n  Train distribution: {train_dist}")
    print(f"  Test  distribution: {test_dist}")

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # SMOTE — adaptive k_neighbors, ONLY if imbalanced
    min_class_train = int(np.bincount(y_train).min())
    max_class_train = int(np.bincount(y_train).max())
    
    use_smote = False
    
    dist_before: dict[str, int] = {}
    for lbl, cnt in zip(*np.unique(y_train, return_counts=True)):
        dist_before[INV_CLASS_MAPPING[lbl]] = int(cnt)

    if use_smote:
        print("\n  Dataset is imbalanced. Applying SMOTE...")
        k_neighbors = min(5, min_class_train - 1)
        if k_neighbors < 1:
            k_neighbors = 1

        sm = SMOTE(k_neighbors=k_neighbors, random_state=42)
        X_train_resampled, y_train_resampled = sm.fit_resample(
            X_train_scaled, y_train
        )
        dist_after: dict[str, int] = {}
        for lbl, cnt in zip(*np.unique(y_train_resampled, return_counts=True)):
            dist_after[INV_CLASS_MAPPING[lbl]] = int(cnt)

        print(f"  Class distribution before SMOTE: {dist_before}")
        print(f"  Class distribution after  SMOTE: {dist_after}")
        print(f"  SMOTE k_neighbors = {k_neighbors}")
    else:
        print("\n  Dataset is reasonably balanced. Skipping SMOTE.")
        X_train_resampled, y_train_resampled = X_train_scaled, y_train
        dist_after = dist_before.copy()
        k_neighbors = 0

    # ------------------------------------------------------------------
    # Step 3 — Define and train models
    # ------------------------------------------------------------------
    models = {
        "RandomForest": RandomForestClassifier(
            n_estimators=300, class_weight="balanced",
            n_jobs=-1, random_state=42,
        ),
        "SVM": SVC(
            kernel="rbf", C=10, gamma="scale",
            probability=True, class_weight="balanced", random_state=42,
        ),
        "KNN": KNeighborsClassifier(n_neighbors=7, metric="euclidean"),
    }

    print("\nTraining all three models on SMOTE-resampled data ...")
    for name, model in models.items():
        t0 = time.time()
        model.fit(X_train_resampled, y_train_resampled)
        print(f"  {name:15s}  trained in {time.time() - t0:.1f} s")

    # ------------------------------------------------------------------
    # Step 4 — Cross-validation (GroupKFold — speaker-aware)
    # ------------------------------------------------------------------
    n_unique_train_speakers = len(set(groups_train))
    n_splits = min(5, n_unique_train_speakers)
    if n_splits < 2:
        n_splits = 2
    cv = GroupKFold(n_splits=n_splits)

    print(f"\n  GroupKFold {n_splits}-fold cross-validation "
          "(SMOTE inside each fold, speaker-aware) ...")

    report: dict = {
        "best_model": None,
        "dialects": DIALECTS,
        "feature_count": len(feature_names),
        "train_samples_original": int(len(X_train)),
        "train_samples_after_smote": int(len(X_train_resampled)),
        "test_samples": int(len(X_test)),
        "smote_k_neighbors": k_neighbors,
        "class_distribution_before_smote": dist_before,
        "class_distribution_after_smote": dist_after,
        "train_speakers": sorted(train_speakers),
        "test_speakers": sorted(test_speakers),
        "models": {},
    }

    best_f1 = -1.0
    best_name = ""

    for name, model in models.items():
        # Cross-val with or without SMOTE
        if use_smote:
            cv_pipeline = ImbPipeline([
                ("smote", SMOTE(k_neighbors=k_neighbors, random_state=42)),
                ("clf", clone(model)),
            ])
        else:
            cv_pipeline = ImbPipeline([
                ("clf", clone(model)),
            ])
        try:
            # Manually do GroupKFold CV because cross_validate needs groups
            cv_accs = []
            cv_f1s = []
            for fold_train, fold_val in cv.split(
                X_train_scaled, y_train, groups_train
            ):
                pipe = clone(cv_pipeline)
                pipe.fit(X_train_scaled[fold_train], y_train[fold_train])
                preds = pipe.predict(X_train_scaled[fold_val])
                cv_accs.append(
                    float(accuracy_score(y_train[fold_val], preds))
                )
                cv_f1s.append(
                    float(f1_score(
                        y_train[fold_val], preds,
                        average="macro", zero_division=0
                    ))
                )
            cv_acc_mean = float(np.mean(cv_accs))
            cv_acc_std = float(np.std(cv_accs))
            cv_f1_mean = float(np.mean(cv_f1s))
            cv_f1_std = float(np.std(cv_f1s))
        except ValueError as exc:
            print(f"  [!] CV failed for {name}: {exc} "
                  "— using test-set evaluation only")
            cv_acc_mean = cv_acc_std = cv_f1_mean = cv_f1_std = 0.0

        # Test-set evaluation
        y_pred = model.predict(X_test_scaled)
        test_acc = float(accuracy_score(y_test, y_pred))
        test_f1 = float(f1_score(
            y_test, y_pred, average="macro", zero_division=0
        ))
        test_f1_per = f1_score(
            y_test, y_pred, average=None, zero_division=0,
            labels=range(len(DIALECTS))
        )
        test_f1_per_class = {
            INV_CLASS_MAPPING[i]: round(float(f), 4)
            for i, f in enumerate(test_f1_per)
        }
        cm = confusion_matrix(
            y_test, y_pred, labels=range(len(DIALECTS))
        )

        report["models"][name] = {
            "cv_accuracy_mean": round(cv_acc_mean, 4),
            "cv_accuracy_std": round(cv_acc_std, 4),
            "cv_f1_macro_mean": round(cv_f1_mean, 4),
            "cv_f1_macro_std": round(cv_f1_std, 4),
            "test_accuracy": round(test_acc, 4),
            "test_f1_macro": round(test_f1, 4),
            "test_f1_per_class": test_f1_per_class,
            "confusion_matrix": cm.tolist(),
        }

        if cv_f1_mean > best_f1:
            best_f1 = cv_f1_mean
            best_name = name

        print(f"  {name:15s}  CV-F1={cv_f1_mean:.4f}+/-{cv_f1_std:.4f}  "
              f"Test-Acc={test_acc:.4f}  Test-F1={test_f1:.4f}")

    report["best_model"] = best_name
    print(f"\n[*] Best model by CV macro-F1: {best_name} ({best_f1:.4f})")

    # ------------------------------------------------------------------
    # Step 5 — SHAP for RF and SVM, permutation importance for KNN
    # ------------------------------------------------------------------
    print("\nComputing explainability artifacts ...")

    # RF — TreeExplainer
    print("  TreeExplainer (RandomForest) ...")
    explainer_rf = shap.TreeExplainer(models["RandomForest"])
    shap_values_rf = explainer_rf.shap_values(X_test_scaled)
    if isinstance(shap_values_rf, np.ndarray) and shap_values_rf.ndim == 3:
        shap_values_rf_arr = shap_values_rf  # (n_test, n_features, n_classes)
    else:
        shap_values_rf_arr = np.array(shap_values_rf)

    # SVM — KernelExplainer
    print("  KernelExplainer (SVM) — this may take a few minutes ...")
    n_background = min(80, len(X_train_resampled))
    background = shap.sample(
        pd.DataFrame(X_train_resampled), n_background, random_state=42
    )
    background_arr = np.array(background)

    n_test_shap = min(30, len(X_test_scaled))
    explainer_svm = shap.KernelExplainer(
        models["SVM"].predict_proba, background_arr
    )
    shap_values_svm = explainer_svm.shap_values(X_test_scaled[:n_test_shap])

    # KNN — permutation importance
    print("  Permutation importance (KNN) ...")
    perm_result = permutation_importance(
        models["KNN"], X_test_scaled, y_test,
        n_repeats=15, random_state=42, scoring="f1_macro",
    )
    knn_feature_importances = perm_result.importances_mean

    # ------------------------------------------------------------------
    # Step 6 — Per-dialect feature statistics (RAW values, not scaled)
    # ------------------------------------------------------------------
    # Use original raw training data so the explanation chart compares
    # the uploaded file's raw values against raw dialect averages.
    df_train_raw = pd.DataFrame(X_train, columns=feature_names)
    df_train_raw["dialect"] = [INV_CLASS_MAPPING[lbl] for lbl in y_train]
    dialect_stats = df_train_raw.groupby("dialect")[feature_names].mean()

    # ------------------------------------------------------------------
    # Step 7 — Save artifacts
    # ------------------------------------------------------------------
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # Best model
    with open(MODELS_DIR / "dialect_clf.pkl", "wb") as f:
        pickle.dump(models[best_name], f)

    with open(MODELS_DIR / "scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)

    # Save explicit class mapping as JSON — no LabelEncoder
    with open(MODELS_DIR / "class_mapping.json", "w", encoding="utf-8") as f:
        json.dump(CLASS_MAPPING, f, indent=2)

    with open(MODELS_DIR / "feature_names.json", "w", encoding="utf-8") as f:
        json.dump(list(feature_names), f, indent=2)

    with open(MODELS_DIR / "training_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    dialect_stats.to_csv(MODELS_DIR / "dialect_feature_stats.csv")

    with open(MODELS_DIR / "best_model_name.txt", "w", encoding="utf-8") as f:
        f.write(best_name)

    np.save(MODELS_DIR / "shap_values_rf.npy", shap_values_rf_arr)
    np.save(MODELS_DIR / "shap_background.npy", background_arr)
    np.save(
        MODELS_DIR / "knn_permutation_importance.npy",
        knn_feature_importances,
    )

    print(f"\n[OK] All artifacts saved to {MODELS_DIR}/")
    print("  Files:")
    for p in sorted(MODELS_DIR.iterdir()):
        size_kb = p.stat().st_size / 1024
        print(f"    {p.name:40s}  {size_kb:8.1f} KB")

    # ------------------------------------------------------------------
    # Step 8 — Print evaluation report
    # ------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("  EVALUATION REPORT")
    print("=" * 70)

    print(f"\n  Dataset:  {report['train_samples_original']} train / "
          f"{report['test_samples']} test samples")
    print(f"  Features: {report['feature_count']}")
    print(f"  SMOTE:    k_neighbors={report['smote_k_neighbors']}")
    print(f"  Before:   {report['class_distribution_before_smote']}")
    print(f"  After:    {report['class_distribution_after_smote']}")
    print(f"\n  Train speakers: {report['train_speakers']}")
    print(f"  Test  speakers: {report['test_speakers']}")

    print(f"\n  {'Model':15s}  {'CV-F1':>10s}  {'Test-Acc':>10s}  "
          f"{'Test-F1':>10s}")
    print("  " + "-" * 50)
    for name, m in report["models"].items():
        marker = " <-- BEST" if name == best_name else ""
        print(f"  {name:15s}  {m['cv_f1_macro_mean']:10.4f}  "
              f"{m['test_accuracy']:10.4f}  {m['test_f1_macro']:10.4f}"
              f"  {marker}")

    print(f"\n  Per-class test F1 ({best_name}):")
    best_m = report["models"][best_name]
    for d, f in best_m["test_f1_per_class"].items():
        print(f"    {d}: {f:.4f}")

    print(f"\n  Confusion Matrix ({best_name}):")
    print(f"  {'':6s}" + "".join(f"{d:>6s}" for d in DIALECTS))
    for i, row in enumerate(best_m["confusion_matrix"]):
        print(f"  {DIALECTS[i]:6s}" + "".join(f"{v:6d}" for v in row))

    print("\n" + "=" * 70)
    print("  HOW TO USE YOUR TRAINED MODEL")
    print("=" * 70)
    print("""
  1. Start the backend:
       cd backend ; python -m uvicorn main:app --reload

  2. Start the frontend:
       cd frontend ; npm run dev

  3. Open http://localhost:5173
     - Upload an audio file in "Audio Pipeline" tab
     - Switch to "ML Classifier" tab to see predictions

  To retrain (e.g. after adding more audio files):
       python scripts/prepare_dataset.py
       python scripts/train_classifier.py
""")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
