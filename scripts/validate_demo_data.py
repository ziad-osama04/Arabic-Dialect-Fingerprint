"""Validate the required 4 dialects x 4 voices demo inventory."""

from __future__ import annotations

import argparse
import csv
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
MANIFEST = BACKEND / "data" / "demo_manifest.csv"
RAW_DIR = BACKEND / "data" / "raw"
DIALECTS = ("EGY", "LAV", "GLF", "MAR")
MIN_VOICES_PER_DIALECT = 4
MIN_SECONDS = 20
MAX_SECONDS = 40


def read_manifest(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def validate_manifest(rows: list[dict[str, str]]) -> list[str]:
    errors = []
    dialect_counts = Counter(row.get("dialect", "") for row in rows)
    speakers_by_dialect: dict[str, set[str]] = defaultdict(set)

    for row in rows:
        dialect = row.get("dialect", "")
        speaker_id = row.get("speaker_id", "")
        file_name = row.get("file_name", "")
        duration_raw = row.get("duration_seconds", "")

        if dialect not in DIALECTS:
            errors.append(f"{file_name}: unsupported dialect '{dialect}'")
            continue

        speakers_by_dialect[dialect].add(speaker_id)

        if not file_name:
            errors.append(f"{dialect}/{speaker_id}: missing file_name")
        else:
            expected_path = RAW_DIR / dialect / file_name
            if not expected_path.exists():
                errors.append(f"{file_name}: missing audio file at {expected_path}")

        try:
            duration = float(duration_raw)
        except ValueError:
            errors.append(f"{file_name}: invalid duration '{duration_raw}'")
        else:
            if duration < MIN_SECONDS or duration > MAX_SECONDS:
                errors.append(
                    f"{file_name}: duration {duration:g}s is outside expected "
                    f"{MIN_SECONDS}-{MAX_SECONDS}s demo range"
                )

        if not row.get("transcript_ar"):
            errors.append(f"{file_name}: missing transcript_ar")
        if not row.get("source"):
            errors.append(f"{file_name}: missing source")
        if not row.get("license"):
            errors.append(f"{file_name}: missing license")

    for dialect in DIALECTS:
        if dialect_counts[dialect] < MIN_VOICES_PER_DIALECT:
            errors.append(
                f"{dialect}: has {dialect_counts[dialect]} manifest rows, "
                f"needs at least {MIN_VOICES_PER_DIALECT}"
            )
        if len(speakers_by_dialect[dialect]) < MIN_VOICES_PER_DIALECT:
            errors.append(
                f"{dialect}: has {len(speakers_by_dialect[dialect])} unique speakers, "
                f"needs at least {MIN_VOICES_PER_DIALECT}"
            )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate demo audio manifest readiness.")
    parser.add_argument("--manifest", default=str(MANIFEST), help="Manifest CSV path.")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        print(f"Missing manifest: {manifest_path}")
        return 1

    rows = read_manifest(manifest_path)
    errors = validate_manifest(rows)

    if errors:
        print("Demo data is not ready:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Demo data manifest is ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

