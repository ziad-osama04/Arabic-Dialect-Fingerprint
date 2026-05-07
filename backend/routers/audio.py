from fastapi import APIRouter


router = APIRouter()


@router.get("/health")
def audio_health():
    return {
        "status": "ok",
        "owner": "member1",
        "todo": [
            "POST /audio/upload",
            "GET /audio/file/{file_id}",
            "GET /audio/spectrogram",
            "POST /audio/mix",
        ],
    }

