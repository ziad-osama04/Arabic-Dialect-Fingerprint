"""Prepare classic audio features for dialect classifier training.

This script expects raw audio under:

    backend/Audios/EGY/*.wav
    backend/Audios/KSA/*.wav
    backend/Audios/JOR/*.wav
    backend/Audios/LEB/*.wav

Member 1 must implement backend/services/feature_extractor.py before this script
can produce the final all_features.csv file.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
RAW_DIR = BACKEND / "Audios" 
OUT_PATH = BACKEND / "data" / "all_features.csv"
DIALECTS = ("EGY", "GLF", "LEV", "MAG")


def ensure_backend_on_path() -> None:
    backend_str = str(BACKEND)
    if backend_str not in sys.path:
        sys.path.insert(0, backend_str)


def iter_audio_files():
    for dialect in DIALECTS:
        dialect_dir = RAW_DIR / dialect
        for path in sorted(dialect_dir.glob("*")):
            if path.suffix.lower() in {".wav", ".mp3", ".flac", ".m4a", ".ogg"}:
                yield dialect, path


def infer_speaker_id(path: Path) -> str:
    parts = path.stem.split("_")
    if len(parts) >= 2:
        return "_".join(parts[:2])
    return path.stem


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract classic ML features from raw dialect audio.")
    parser.add_argument("--output", default=str(OUT_PATH), help="Output CSV path.")
    args = parser.parse_args()

    ensure_backend_on_path()

    try:
        from services.audio_utils import duration_seconds, load_audio, trim_silence
        from services.feature_extractor import extract_features
    except ModuleNotFoundError as exc:
        print(
            "Feature extraction is not ready yet. Member 1 must add "
            "backend/services/feature_extractor.py before running this script."
        )
        print(f"Import error: {exc}")
        return 1

    rows = []
    for dialect, path in iter_audio_files():
        y, sr = load_audio(path)
        y = trim_silence(y)
        duration = duration_seconds(y, sr)
        
        # Skip extremely short clips that might cause librosa errors (width=9 for delta)
        # 0.5s at 22050Hz is plenty of frames.
        if duration < 0.5:
            print(f"  Skipping {path.name} (too short: {duration:.2f}s)")
            continue
            
        try:
            features = extract_features(y, sr)
        except Exception as e:
            print(f"  Error extracting features for {path.name}: {e}")
            continue
            
        rows.append(
            {
                "file_name": path.name,
                "dialect": dialect,
                "speaker_id": infer_speaker_id(path),
                "duration_seconds": duration_seconds(y, sr),
                **features,
            }
        )

    if not rows:
        print(f"No audio files found under {RAW_DIR}")
        return 1

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys())

    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
