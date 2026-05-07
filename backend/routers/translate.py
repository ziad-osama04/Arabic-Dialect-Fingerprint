from fastapi import APIRouter


router = APIRouter()


@router.get("/health")
def translate_health():
    return {
        "status": "ok",
        "owner": "member4",
        "todo": [
            "POST /translate/text",
            "POST /translate/synthesize",
        ],
    }

