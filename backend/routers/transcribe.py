import os
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.stt_service import transcribe
from services.audio_utils import UPLOAD_DIR

router = APIRouter()

# In-memory storage for transcriptions (per session)
# In production, this would be a database or persistent cache
transcriptions_cache = {}

@router.get("/health")
def transcribe_health():
    """Check if the transcription service is ready."""
    return {
        "status": "ok",
        "service": "Faster-Whisper STT",
        "cache_size": len(transcriptions_cache)
    }

@router.post("")
async def upload_and_transcribe(file: UploadFile = File(...)):
    """Upload a file and get its transcription immediately."""
    file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1]
    file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
    
    # Ensure upload directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    try:
        words = transcribe(file_path)
        transcriptions_cache[file_id] = words
        return {"file_id": file_id, "words": words}
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@router.get("/words")
async def get_words(file_id: str):
    """Retrieve words for a previously transcribed file."""
    if file_id not in transcriptions_cache:
        raise HTTPException(status_code=404, detail="Transcription not found in cache")
    return {"words": transcriptions_cache[file_id]}

@router.post("/demo/{file_id}")
async def transcribe_demo(file_id: str):
    """Transcribe an existing demo file by ID."""
    # Search for the file in the data/raw subdirectories
    DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
    file_path = None
    for dialect_dir in DATA_DIR.iterdir():
        if dialect_dir.is_dir():
            potential_path = dialect_dir / f"{file_id}.wav"
            if potential_path.exists():
                file_path = potential_path
                break
    
    if not file_path:
        # Also check uploads
        file_path = UPLOAD_DIR / f"{file_id}.wav"
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Demo file not found")

    try:
        words = transcribe(file_path)
        transcriptions_cache[file_id] = words
        return {"file_id": file_id, "words": words}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

