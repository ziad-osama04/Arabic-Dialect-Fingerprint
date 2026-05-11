import os
import time
import requests
import asyncio
import aiohttp
from pathlib import Path
import re

DATASET = "badrex/MADIS5-spoken-arabic-dialects"
CONFIG = "default"
SPLIT = "test"
BASE_API = "https://datasets-server.huggingface.co"

COUNTRY_TO_DIALECT = {
    "Egyptian Arabic": "EGY",
    "Gulf Arabic": "GLF",
    "Levantine Arabic": "LEV",
    "Maghrebi Arabic": "MAG"
}

SAMPLES_PER_DIALECT = 500
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def fetch_rows(offset: int, length: int = 100) -> list[dict]:
    url = f"{BASE_API}/rows?dataset={DATASET}&config={CONFIG}&split={SPLIT}&offset={offset}&length={length}"
    for _ in range(5):
        try:
            resp = requests.get(url, timeout=60)
            resp.raise_for_status()
            return resp.json().get("rows", [])
        except requests.exceptions.RequestException as e:
            print(f"API Error {e}, retrying in 3s...")
            time.sleep(3)
    return []

async def download_audio(session, url, dest_path):
    try:
        async with session.get(url, timeout=30) as resp:
            resp.raise_for_status()
            content = await resp.read()
            with open(dest_path, "wb") as f:
                f.write(content)
            return True
    except Exception as e:
        print(f"Error downloading {dest_path}: {e}")
        return False

async def main():
    needed = {country: SAMPLES_PER_DIALECT for country in COUNTRY_TO_DIALECT}
    
    for dialect_code in COUNTRY_TO_DIALECT.values():
        os.makedirs(os.path.join(SCRIPT_DIR, dialect_code), exist_ok=True)
        
    offset = 0
    page_size = 100
    
    print(f"Scanning {DATASET} dataset. Target: {SAMPLES_PER_DIALECT} per dialect.")
    
    async with aiohttp.ClientSession() as session:
        tasks = []
        downloading_counts = {c: 0 for c in COUNTRY_TO_DIALECT}
        
        while any(n > 0 for n in needed.values()):
            rows = fetch_rows(offset, page_size)
            if not rows:
                break
                
            for row_entry in rows:
                row = row_entry.get("row", {})
                dialect = row.get("dialect", "")
                
                if dialect not in needed or needed[dialect] <= 0:
                    continue
                
                audio_entries = row.get("audio", [])
                if isinstance(audio_entries, dict):
                    audio_entries = [audio_entries] # sometimes it's a dict
                
                audio_url = ""
                if audio_entries and isinstance(audio_entries, list) and isinstance(audio_entries[0], dict):
                    audio_url = audio_entries[0].get("src", "")
                
                if not audio_url:
                    if isinstance(row.get("audio"), dict) and "src" in row["audio"]:
                        audio_url = row["audio"]["src"]
                    else:
                        # try getting url directly from the row if it's there
                        pass
                
                # If still no audio_url, maybe datasets-server gives a different format?
                # Sometimes it gives {"path": "...", "array": ...} but datasets-server usually gives {"src": "url"}
                # Let's inspect the exact audio field if it fails
                if not audio_url:
                    if isinstance(row.get("audio"), list) and len(row.get("audio"))>0:
                        audio_url = row.get("audio")[0].get("src", "")
                
                if not audio_url:
                    audio_url = row.get("audio", {}).get("src", "")
                
                if not audio_url:
                    continue
                    
                dialect_code = COUNTRY_TO_DIALECT[dialect]
                segment_id = row.get("segment_id", f"sample_{offset}")
                filename = f"{segment_id}.wav"
                filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
                dest = os.path.join(SCRIPT_DIR, dialect_code, filename)
                
                tasks.append(download_audio(session, audio_url, dest))
                needed[dialect] -= 1
                downloading_counts[dialect] += 1
                
                if all(n <= 0 for n in needed.values()):
                    break
                    
            print(f"Discovered samples so far: {downloading_counts}")
            offset += page_size
            time.sleep(0.1)
            
            if len(tasks) >= 50:
                print(f"Downloading batch of {len(tasks)} files...")
                await asyncio.gather(*tasks)
                tasks = []
                
        if tasks:
            print(f"Downloading final batch of {len(tasks)} files...")
            await asyncio.gather(*tasks)
            
    print("\nDownload Summary:")
    for country, dialect_code in COUNTRY_TO_DIALECT.items():
        print(f"  {dialect_code}: {downloading_counts[country]} files")

if __name__ == "__main__":
    asyncio.run(main())
