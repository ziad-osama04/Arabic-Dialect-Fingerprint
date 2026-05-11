"""Dialect classification service — inference-time prediction and SHAP explanation.

Loads pre-trained artifacts from backend/models/ and provides dialect
prediction with confidence scores and SHAP-based explainability.

Encoding: Uses an explicit {dialect: int} JSON mapping instead of
sklearn LabelEncoder. This makes clear there is no ordinal assumption.
"""

from __future__ import annotations

import base64
import io
import json
import pickle
from pathlib import Path
from typing import Any

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from services.feature_extractor import extract_features

matplotlib.use("Agg")  # Non-interactive backend for server-side rendering


class DialectClassifier:
    """Loads pre-trained model artifacts and provides dialect prediction
    and SHAP-based explainability for a single audio clip."""

    DIALECTS = ["EGY", "GLF", "LEV", "MAG"]
    DIALECT_NAMES = {
        "EGY": "Egyptian",
        "GLF": "Gulf",
        "LEV": "Levantine",
        "MAG": "Maghrebi",
    }
    DIALECT_COLORS = {
        "EGY": "#8b5cf6",
        "GLF": "#34d399",
        "LEV": "#38bdf8",
        "MAG": "#fb923c",
    }
    MODELS_DIR = Path(__file__).resolve().parents[1] / "models"

    def __init__(self) -> None:
        """Load all artifacts from backend/models/.

        Raises:
            FileNotFoundError: If required model files are missing.
        """
        models_dir = self.MODELS_DIR

        with open(models_dir / "dialect_clf.pkl", "rb") as f:
            self._model: Any = pickle.load(f)

        with open(models_dir / "scaler.pkl", "rb") as f:
            self._scaler: Any = pickle.load(f)

        # Load explicit class mapping (replaces LabelEncoder)
        with open(models_dir / "class_mapping.json", "r", encoding="utf-8") as f:
            self._class_mapping: dict[str, int] = json.load(f)
        self._inv_class_mapping: dict[int, str] = {
            v: k for k, v in self._class_mapping.items()
        }

        with open(models_dir / "feature_names.json", "r", encoding="utf-8") as f:
            self._feature_names: list[str] = json.load(f)

        with open(models_dir / "best_model_name.txt", "r", encoding="utf-8") as f:
            self._model_name: str = f.read().strip()

        self._dialect_stats: pd.DataFrame = pd.read_csv(
            models_dir / "dialect_feature_stats.csv", index_col=0,
        )

        # Load explainability artifacts
        shap_bg_path = models_dir / "shap_background.npy"
        self._shap_background: np.ndarray | None = (
            np.load(shap_bg_path) if shap_bg_path.exists() else None
        )

        knn_pi_path = models_dir / "knn_permutation_importance.npy"
        self._knn_permutation_importance: np.ndarray | None = (
            np.load(knn_pi_path) if knn_pi_path.exists() else None
        )

        # Pre-create TreeExplainer for RF (fast to create, safe to cache)
        self._shap_explainer: Any = None
        if self._model_name == "RandomForest":
            import shap
            self._shap_explainer = shap.TreeExplainer(self._model)

    # ------------------------------------------------------------------
    # Helpers for label encoding/decoding (replaces LabelEncoder)
    # ------------------------------------------------------------------

    def _idx_to_dialect(self, idx: int) -> str:
        """Convert class index to dialect code string."""
        return self._inv_class_mapping[idx]

    def _dialect_to_idx(self, dialect: str) -> int:
        """Convert dialect code string to class index."""
        return self._class_mapping[dialect]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, y: np.ndarray, sr: int) -> dict:
        """Predict the dialect of an audio clip.

        Args:
            y: Audio signal as float32 numpy array.
            sr: Sample rate.

        Returns:
            Dict with dialect, dialect_name, confidence, probabilities,
            top_features (top 10 by |SHAP|), and model_used.
        """
        X_scaled, feature_dict = self._extract_and_scale(y, sr)

        proba = self._model.predict_proba(X_scaled.reshape(1, -1))[0]
        pred_idx = int(np.argmax(proba))
        pred_label = self._idx_to_dialect(pred_idx)

        probabilities = {
            self._idx_to_dialect(i): round(float(p), 4)
            for i, p in enumerate(proba)
        }

        # SHAP values for top features
        try:
            shap_vals = self._compute_shap_for_sample(X_scaled)
            shap_for_pred = shap_vals[pred_idx]  # shape (n_features,)
        except Exception:
            shap_for_pred = np.zeros(len(self._feature_names))

        # Top 10 by |SHAP value|
        top_idxs = np.argsort(np.abs(shap_for_pred))[::-1][:10]
        top_features = [
            {
                "name": self._feature_names[i],
                "value": round(float(feature_dict[self._feature_names[i]]), 4),
                "shap_value": round(float(shap_for_pred[i]), 4),
            }
            for i in top_idxs
        ]

        return {
            "dialect": pred_label,
            "dialect_name": self.DIALECT_NAMES.get(pred_label, pred_label),
            "confidence": round(float(proba[pred_idx]), 4),
            "probabilities": probabilities,
            "top_features": top_features,
            "model_used": self._model_name,
        }

    def explain(self, y: np.ndarray, sr: int) -> dict:
        """Generate a feature explanation for an audio clip.

        Args:
            y: Audio signal as float32 numpy array.
            sr: Sample rate.

        Returns:
            Dict with plot_b64 (PNG chart), feature_values, shap_per_class,
            and nearest_dialects sorted by probability.
        """
        X_scaled, feature_dict = self._extract_and_scale(y, sr)

        proba = self._model.predict_proba(X_scaled.reshape(1, -1))[0]
        pred_idx = int(np.argmax(proba))

        # SHAP values
        try:
            shap_vals = self._compute_shap_for_sample(X_scaled)
        except Exception:
            shap_vals = np.zeros((len(self.DIALECTS), len(self._feature_names)))

        # Generate chart
        plot_b64 = self._generate_comparison_chart(
            feature_dict, shap_vals, pred_idx
        )

        # SHAP per class: sum of |SHAP| for top 10 features per class
        shap_per_class: dict[str, float] = {}
        for c_idx, dialect in enumerate(self.DIALECTS):
            class_shap = shap_vals[c_idx]
            top10_idxs = np.argsort(np.abs(class_shap))[::-1][:10]
            shap_per_class[dialect] = round(
                float(np.sum(class_shap[top10_idxs])), 4
            )

        # Nearest dialects sorted by probability
        nearest = sorted(
            [
                {
                    "dialect": self._idx_to_dialect(i),
                    "dialect_name": self.DIALECT_NAMES.get(
                        self._idx_to_dialect(i), self._idx_to_dialect(i)
                    ),
                    "probability": round(float(p), 4),
                }
                for i, p in enumerate(proba)
            ],
            key=lambda x: x["probability"],
            reverse=True,
        )

        return {
            "plot_b64": plot_b64,
            "feature_values": {
                k: round(float(v), 4) for k, v in feature_dict.items()
            },
            "shap_per_class": shap_per_class,
            "nearest_dialects": nearest,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _extract_and_scale(
        self, y: np.ndarray, sr: int
    ) -> tuple[np.ndarray, dict]:
        """Extract features, scale, return (X_scaled_1d, feature_dict).

        Args:
            y: Audio signal.
            sr: Sample rate.

        Returns:
            Tuple of (scaled feature vector, raw feature dict).
        """
        feature_dict = extract_features(y, sr)

        feature_vector = np.array(
            [feature_dict[name] for name in self._feature_names],
            dtype=np.float64,
        )

        X_scaled = self._scaler.transform(feature_vector.reshape(1, -1))[0]
        return X_scaled, feature_dict

    def _compute_shap_for_sample(self, X_scaled: np.ndarray) -> np.ndarray:
        """Compute SHAP values for a single scaled sample.

        For RF: uses TreeExplainer (fast, exact).
        For SVM: uses KernelExplainer with saved background data.
        For KNN: returns pre-computed permutation importances (global).

        Args:
            X_scaled: Scaled feature vector, shape (n_features,).

        Returns:
            Array of shape (n_classes, n_features).
        """
        import shap

        X_2d = X_scaled.reshape(1, -1)

        if self._model_name == "RandomForest":
            if self._shap_explainer is None:
                self._shap_explainer = shap.TreeExplainer(self._model)
            shap_vals = self._shap_explainer.shap_values(X_2d)
            # Handle both list and ndarray formats
            if isinstance(shap_vals, np.ndarray) and shap_vals.ndim == 3:
                return shap_vals[0].T  # (1, features, classes) -> (classes, features)
            return np.array([sv[0] for sv in shap_vals])

        elif self._model_name == "SVM":
            if self._shap_background is None:
                raise ValueError(
                    "SHAP background data not found for SVM explainer."
                )
            explainer = shap.KernelExplainer(
                self._model.predict_proba, self._shap_background
            )
            shap_vals = explainer.shap_values(X_2d)
            # shap >= 0.40 returns ndarray (1, n_features, n_classes)
            if isinstance(shap_vals, np.ndarray) and shap_vals.ndim == 3:
                return shap_vals[0].T
            return np.array([sv[0] for sv in shap_vals])

        else:
            # KNN — use pre-computed permutation importance (global)
            if self._knn_permutation_importance is not None:
                importances = self._knn_permutation_importance
            else:
                importances = np.zeros(len(self._feature_names))
            return np.tile(importances, (len(self.DIALECTS), 1))

    def _generate_comparison_chart(
        self,
        feature_dict: dict,
        shap_values: np.ndarray,
        predicted_class_idx: int,
    ) -> str:
        """Generate a matplotlib chart comparing the uploaded file's raw
        features against per-dialect raw averages for the top 10 SHAP
        features.

        Args:
            feature_dict: Raw feature values for the uploaded clip.
            shap_values: SHAP array of shape (n_classes, n_features).
            predicted_class_idx: Index of the predicted class.

        Returns:
            Base64-encoded PNG string.
        """
        predicted_dialect = self._idx_to_dialect(predicted_class_idx)
        dialect_name = self.DIALECT_NAMES.get(
            predicted_dialect, predicted_dialect
        )

        # Get top 10 features by |SHAP| for the predicted class
        shap_pred = shap_values[predicted_class_idx]
        top_idxs = np.argsort(np.abs(shap_pred))[::-1][:10]
        top_feature_names = [self._feature_names[i] for i in top_idxs]

        plt.style.use("dark_background")
        fig, axes = plt.subplots(2, 5, figsize=(16, 7), facecolor="#0f172a")
        fig.suptitle(
            f"Top 10 Distinguishing Features — Predicted: {dialect_name}",
            color="#f8fafc",
            fontsize=13,
            fontweight="bold",
            y=0.98,
        )

        dialect_labels = self.DIALECTS
        colors = [self.DIALECT_COLORS[d] for d in dialect_labels]

        for ax_idx, ax in enumerate(axes.flat):
            if ax_idx >= len(top_feature_names):
                ax.set_visible(False)
                continue

            feat_name = top_feature_names[ax_idx]

            # Dialect mean values from training stats (raw values)
            dialect_means = []
            for d in dialect_labels:
                if (
                    d in self._dialect_stats.index
                    and feat_name in self._dialect_stats.columns
                ):
                    dialect_means.append(
                        float(self._dialect_stats.loc[d, feat_name])
                    )
                else:
                    dialect_means.append(0.0)

            # Uploaded file's raw value
            uploaded_val = float(feature_dict.get(feat_name, 0.0))

            ax.barh(
                dialect_labels, dialect_means,
                color=colors, alpha=0.85, height=0.6,
            )
            ax.axvline(
                uploaded_val,
                color="#f8fafc",
                linestyle="--",
                linewidth=1.5,
                label="This file",
            )

            # Format feature name for display
            display_name = feat_name.replace("_", " ")
            if len(display_name) > 20:
                display_name = display_name[:18] + "…"
            ax.set_title(display_name, color="#94a3b8", fontsize=8, pad=4)
            ax.tick_params(colors="#64748b", labelsize=7)
            ax.set_facecolor("#0f172a")

            for spine in ax.spines.values():
                spine.set_color("#1e293b")

        plt.tight_layout(rect=[0, 0, 1, 0.94])

        buf = io.BytesIO()
        fig.savefig(buf, format="png", facecolor="#0f172a", dpi=120)
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")


# ------------------------------------------------------------------
# Singleton accessor
# ------------------------------------------------------------------

_classifier_instance: DialectClassifier | None = None


def get_classifier() -> DialectClassifier:
    """Lazily instantiate and return the singleton DialectClassifier.

    Raises:
        FileNotFoundError: If model artifacts are missing.
    """
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = DialectClassifier()
    return _classifier_instance
