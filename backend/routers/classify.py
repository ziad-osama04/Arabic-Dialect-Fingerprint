from fastapi import APIRouter


router = APIRouter()


@router.get("/health")
def classify_health():
    return {
        "status": "ok",
        "owner": "member2",
        "todo": [
            "GET /classify/predict",
            "GET /classify/explain",
        ],
    }

