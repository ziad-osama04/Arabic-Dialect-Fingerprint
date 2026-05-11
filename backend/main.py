# Arabic Dialect Fingerprint - API Entry point
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import audio, classify, transcribe, translate


app = FastAPI(title="Arabic Dialect Fingerprint")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audio.router, prefix="/audio", tags=["audio"])
app.include_router(classify.router, prefix="/classify", tags=["classify"])
app.include_router(transcribe.router, prefix="/transcribe", tags=["transcribe"])
app.include_router(translate.router, prefix="/translate", tags=["translate"])


@app.get("/")
def root():
    return {
        "name": "Arabic Dialect Fingerprint",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}

