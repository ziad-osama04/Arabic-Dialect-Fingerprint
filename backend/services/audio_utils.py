from pathlib import Path

import librosa
import numpy as np
import soundfile as sf


TARGET_SR = 16000
BASE_DIR = Path(__file__).resolve().parents[1]
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def load_audio(path: str | Path, sr: int = TARGET_SR):
    """Load audio as mono float32 for all downstream processing."""
    y, loaded_sr = librosa.load(str(path), sr=sr, mono=True)
    return y.astype(np.float32), loaded_sr


def trim_silence(y: np.ndarray, top_db: int = 20) -> np.ndarray:
    """Remove leading and trailing silence while keeping speech content."""
    y_trimmed, _ = librosa.effects.trim(y, top_db=top_db)
    return y_trimmed.astype(np.float32)


def normalize_audio(y: np.ndarray, target_peak: float = 0.95) -> np.ndarray:
    """Normalize to a safe peak level to avoid clipping after mixing."""
    if y.size == 0:
        return y.astype(np.float32)

    peak = float(np.max(np.abs(y)))
    if peak <= 1e-8:
        return y.astype(np.float32)

    return (y / peak * target_peak).astype(np.float32)


def save_wav(path: str | Path, y: np.ndarray, sr: int = TARGET_SR) -> Path:
    """Save normalized mono audio as WAV and return its path."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), normalize_audio(y), sr)
    return path


def duration_seconds(y: np.ndarray, sr: int) -> float:
    if sr <= 0:
        return 0.0
    return round(float(len(y) / sr), 3)

