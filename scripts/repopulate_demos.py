import os
import shutil
from pathlib import Path

def repopulate_demos():
    root = Path('g:/Arabic-Dialect-Fingerprint')
    demo_dir = root / 'Downloaded Test Samples'
    audios_dir = root / 'backend/Audios'
    dialects = ['EGY', 'GLF', 'LEV', 'MAG']

    if demo_dir.exists():
        shutil.rmtree(demo_dir)
    demo_dir.mkdir(parents=True, exist_ok=True)

    for d in dialects:
        target_d_dir = demo_dir / d
        target_d_dir.mkdir(parents=True, exist_ok=True)
        
        src_d_dir = audios_dir / d
        if src_d_dir.exists():
            # Get up to 4 files
            audio_files = [f for f in os.listdir(src_d_dir) if f.lower().endswith(('.wav', '.mp3', '.m4a'))]
            audio_files.sort()
            for f in audio_files[:4]:
                shutil.copy(src_d_dir / f, target_d_dir / f)
                print(f"Copied {f} to demo/{d}")

if __name__ == "__main__":
    repopulate_demos()
