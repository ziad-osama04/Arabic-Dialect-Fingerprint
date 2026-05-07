from fastapi import APIRouter


router = APIRouter()


@router.get("/health")
def transcribe_health():
    return {
        "status": "ok",
        "owner": "member3",
        "todo": [
            "GET /transcribe/words",
            "GET /transcribe/stream",
        ],
    }

