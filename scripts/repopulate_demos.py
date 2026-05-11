import os
import shutil
from pathlib import Path

def repopulate_demos():
    # Use dynamic root discovery
    root = Path(__file__).resolve().parents[1]
    demo_dir = root / 'backend' / 'data' / 'raw'
    audios_dir = root / 'backend' / 'Audios'
    dialects = ['EGY', 'GLF', 'LEV', 'MAG']

    # We don't necessarily want to rmtree(demo_dir) as it might contain the dataset
    # But for a "repopulate" script, it makes sense to ensure a clean small set
    print(f"Repopulating demo samples in: {demo_dir}")

    for d in dialects:
        target_d_dir = demo_dir / d
        target_d_dir.mkdir(parents=True, exist_ok=True)
        
        src_d_dir = audios_dir / d
        if src_d_dir.exists():
            # Get up to 4 files from the download cache/source
            audio_files = [f for f in os.listdir(src_d_dir) if f.lower().endswith(('.wav', '.mp3', '.m4a'))]
            audio_files.sort()
            for f in audio_files[:4]:
                shutil.copy(src_d_dir / f, target_d_dir / f)
                print(f"Copied {f} to {d}")
        else:
            print(f"Source directory not found: {src_d_dir}")

if __name__ == "__main__":
    repopulate_demos()
