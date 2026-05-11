"""Classify router — dialect prediction and SHAP explanation endpoints."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException

from services.audio_utils import UPLOAD_DIR, load_audio, trim_silence
from services.classifier import DialectClassifier, get_classifier

router = APIRouter()

_FILE_ID_PATTERN = re.compile(r"^[\w\-]+$")


def _validate_file_id(file_id: str) -> None:
    """Validate file_id against path traversal attacks."""
    if not _FILE_ID_PATTERN.match(file_id):
        raise HTTPException(400, "Invalid file_id format.")


def _load_classifier() -> DialectClassifier:
    """Load the classifier singleton, raising 503 if not trained yet."""
    try:
        return get_classifier()
    except FileNotFoundError:
        raise HTTPException(
            503,
            "Model not trained yet. Run scripts/train_classifier.py first.",
        )


@router.get("/health")
def classify_health() -> dict:
    """Health check — reports whether the model is loaded."""
    try:
        clf = get_classifier()
        return {
            "status": "ok",
            "model_loaded": True,
            "model_name": clf._model_name,
            "dialects": DialectClassifier.DIALECTS,
        }
    except FileNotFoundError:
        return {
            "status": "ok",
            "model_loaded": False,
            "model_name": None,
            "dialects": [],
        }


@router.get("/predict")
def classify_predict(file_id: str) -> dict:
    """Predict the dialect of an uploaded audio file.

    Args:
        file_id: Identifier for the uploaded WAV file.

    Returns:
        Prediction dict with dialect, confidence, probabilities,
        top features, and model name.
    """
    _validate_file_id(file_id)
    clf = _load_classifier()

    wav_path = UPLOAD_DIR / f"{file_id}.wav"
    if not wav_path.exists():
        raise HTTPException(404, "File not found.")

    y, sr = load_audio(wav_path)
    y = trim_silence(y)

    return clf.predict(y, sr)


@router.get("/explain")
def classify_explain(file_id: str) -> dict:
    """Generate SHAP-based feature explanation for an uploaded audio file.

    Args:
        file_id: Identifier for the uploaded WAV file.

    Returns:
        Explanation dict with comparison chart (base64 PNG),
        feature values, SHAP per class, and nearest dialects.
    """
    _validate_file_id(file_id)
    clf = _load_classifier()

    wav_path = UPLOAD_DIR / f"{file_id}.wav"
    if not wav_path.exists():
        raise HTTPException(404, "File not found.")

    y, sr = load_audio(wav_path)
    y = trim_silence(y)

    return clf.explain(y, sr)
