# Task 5 – Arabic Dialect Fingerprint: Full Pipeline & Member Distribution

---

## Project Overview

A web application that:
1. Loads a ~30s Arabic audio file and visualizes its spectrogram
2. Uses **classic ML only** to identify the dialect (4 dialects, 4 voices each)
3. Displays transcribed words in **real-time** as the file plays
4. Translates and synthesizes the audio into **another dialect** (text + tone)
5. Mixes two audio files with a **weighted slider** and classifies the blend

**Dialects chosen:** Egyptian (EGY), Levantine/Syrian (LAV), Gulf/Khaleeji (GLF), Moroccan (MAR)

---

## Technology Stack

| Layer | Tool |
|---|---|
| Frontend | React + Tailwind CSS |
| Backend | FastAPI (Python) |
| Audio features | librosa, scipy, numpy |
| Classic ML | scikit-learn (SVM, Random Forest) |
| STT | Whisper-small-ar via HuggingFace pipeline |
| Dialect translation | Nile-Chat 4B or Qwen-8B via local inference / API |
| TTS | Habibi-TTS (Apache 2.0: EGY, MAR, IRQ, MSA) |
| Dataset | ADI17 (CC BY-SA) + manually collected clips |

---

## Folder Structure (Member 0 sets this up)

```
arabic-dialect-app/
├── backend/
│   ├── main.py                    # FastAPI entry point, all route registration
│   ├── routers/
│   │   ├── audio.py               # /upload, /spectrogram, /mix endpoints
│   │   ├── classify.py            # /classify endpoint
│   │   ├── transcribe.py          # /transcribe + /transcribe-stream endpoints
│   │   └── translate.py           # /translate + /synthesize endpoints
│   ├── services/
│   │   ├── feature_extractor.py   # All librosa feature logic
│   │   ├── classifier.py          # Trained sklearn model loading + inference
│   │   ├── stt_service.py         # Whisper pipeline wrapper
│   │   ├── llm_service.py         # LLM dialect translation logic
│   │   └── tts_service.py         # Habibi-TTS synthesis wrapper
│   ├── models/
│   │   └── dialect_clf.pkl        # Saved trained sklearn model
│   ├── data/
│   │   ├── raw/                   # Raw audio clips per dialect
│   │   │   ├── EGY/
│   │   │   ├── LAV/
│   │   │   ├── GLF/
│   │   │   └── MAR/
│   │   └── features/              # Precomputed feature CSVs for training
│   ├── notebooks/
│   │   └── train_classifier.ipynb # Training + evaluation notebook
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── AudioUploader.jsx       # File upload UI
│   │   │   ├── SpectrogramViewer.jsx   # Renders spectrogram + feature overlays
│   │   │   ├── ClassifierResult.jsx    # Shows dialect + feature explanation
│   │   │   ├── TranscriptionPanel.jsx  # Real-time word display
│   │   │   ├── DialectTranslator.jsx   # Target dialect picker + TTS player
│   │   │   └── MixerPanel.jsx          # Two-file upload + slider + blend result
│   │   └── api/
│   │       └── client.js           # All fetch calls to backend
│   ├── public/
│   └── package.json
├── scripts/
│   └── prepare_dataset.py         # Bulk feature extraction from raw clips
└── README.md
```

---

---

# Member 0 – Project Architect & Integrator

**Responsibilities:** Set up the repo, skeleton code, shared contracts, and make sure all 4 members can work in parallel without stepping on each other.

## Tasks

### 1. Initialize the Project

```bash
# Backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn python-multipart librosa scipy numpy scikit-learn

# Frontend
npm create vite@latest frontend -- --template react
cd frontend && npm install axios tailwindcss
```

### 2. Write `backend/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import audio, classify, transcribe, translate

app = FastAPI(title="Arabic Dialect Fingerprint")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(audio.router,      prefix="/audio")
app.include_router(classify.router,   prefix="/classify")
app.include_router(transcribe.router, prefix="/transcribe")
app.include_router(translate.router,  prefix="/translate")
```

### 3. Shared Audio Utility (`services/audio_utils.py`)

```python
import librosa, numpy as np

def load_audio(path: str, sr: int = 16000):
    """Standard loader used by all members."""
    y, sr = librosa.load(path, sr=sr, mono=True)
    return y, sr

def trim_silence(y, top_db=20):
    y_trimmed, _ = librosa.effects.trim(y, top_db=top_db)
    return y_trimmed
```

### 4. Define API Contracts (share with the team)

| Endpoint | Method | Input | Output |
|---|---|---|---|
| `/audio/upload` | POST | `file: UploadFile` | `{ file_id, duration }` |
| `/audio/spectrogram` | GET | `?file_id=` | `{ image_b64, peaks: [{t,f}] }` |
| `/audio/mix` | POST | `{ file_id_a, file_id_b, weight }` | `{ mixed_file_id }` |
| `/classify/predict` | GET | `?file_id=` | `{ dialect, probabilities, features }` |
| `/transcribe/stream` | GET (SSE) | `?file_id=` | stream of `{ word, timestamp }` |
| `/translate/text` | POST | `{ text, src_dialect, tgt_dialect }` | `{ translated_text }` |
| `/translate/synthesize` | POST | `{ text, dialect }` | audio bytes |

### 5. Dataset Prep Script (`scripts/prepare_dataset.py`)

Runs through `data/raw/` and calls `feature_extractor.py` on every file. Outputs `data/features/all_features.csv` for training.

```python
import os, pandas as pd
from pathlib import Path
# ... iterate dialect folders, extract features, label, save CSV
```

---

---

# Member 1 – Audio Loading, Spectrogram & Feature Extraction

**Focus:** Tasks 1 and the shared feature pipeline that Members 2 and 5 both depend on.

## What You Own
- `routers/audio.py`
- `services/feature_extractor.py`
- `frontend/src/components/SpectrogramViewer.jsx`
- `frontend/src/components/AudioUploader.jsx`

---

## Step 1: Upload Endpoint (`routers/audio.py`)

```python
import uuid, shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File

router = APIRouter()
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@router.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    dest = UPLOAD_DIR / f"{file_id}.wav"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    import librosa
    y, sr = librosa.load(str(dest), sr=None)
    return {"file_id": file_id, "duration": len(y) / sr}
```

---

## Step 2: Spectrogram Endpoint

```python
import librosa, librosa.display, numpy as np
import matplotlib.pyplot as plt, io, base64

@router.get("/spectrogram")
def get_spectrogram(file_id: str):
    path = UPLOAD_DIR / f"{file_id}.wav"
    y, sr = librosa.load(str(path), sr=16000)

    # Mel spectrogram
    S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=8000)
    S_dB = librosa.power_to_db(S, ref=np.max)

    fig, ax = plt.subplots(figsize=(12, 4))
    librosa.display.specshow(S_dB, sr=sr, x_axis='time', y_axis='mel', ax=ax)
    ax.set_title("Mel Spectrogram")
    plt.colorbar(format='%+2.0f dB', ax=ax)

    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight')
    plt.close()
    buf.seek(0)
    img_b64 = base64.b64encode(buf.read()).decode()

    return {"image_b64": img_b64}
```

---

## Step 3: Feature Extractor (`services/feature_extractor.py`)

This is the **central module** – used by Member 2 for training and Member 5 for the mixer.

```python
import librosa, numpy as np

def extract_features(y: np.ndarray, sr: int) -> dict:
    """
    Returns a flat dict of all features for one audio clip.
    Everything here is classic signal processing – no neural networks.
    """
    features = {}

    # --- MFCCs (captures vocal tract shape per dialect) ---
    # 13 coefficients, each summarized as mean + std across time
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    for i, coef in enumerate(mfcc):
        features[f"mfcc_{i}_mean"] = float(np.mean(coef))
        features[f"mfcc_{i}_std"]  = float(np.std(coef))

    # --- Spectral Centroid (brightness of the sound) ---
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    features["centroid_mean"] = float(np.mean(centroid))
    features["centroid_std"]  = float(np.std(centroid))

    # --- Spectral Rolloff (frequency below which 85% of energy sits) ---
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)
    features["rolloff_mean"] = float(np.mean(rolloff))
    features["rolloff_std"]  = float(np.std(rolloff))

    # --- Spectral Contrast (difference between peaks and valleys per sub-band) ---
    # Captures how "sharp" or "flat" the frequency profile is – varies a lot per dialect
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr, n_bands=6)
    for i, band in enumerate(contrast):
        features[f"contrast_{i}_mean"] = float(np.mean(band))

    # --- Zero Crossing Rate (roughness / voicing) ---
    zcr = librosa.feature.zero_crossing_rate(y)
    features["zcr_mean"] = float(np.mean(zcr))
    features["zcr_std"]  = float(np.std(zcr))

    # --- RMS Energy (loudness envelope) ---
    rms = librosa.feature.rms(y=y)
    features["rms_mean"] = float(np.mean(rms))
    features["rms_std"]  = float(np.std(rms))

    # --- Chroma (pitch class profile – which "notes" dominate) ---
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    for i, ch in enumerate(chroma):
        features[f"chroma_{i}_mean"] = float(np.mean(ch))

    # --- Tempo (speech rhythm differs per dialect) ---
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    features["tempo"] = float(tempo)

    return features


def extract_feature_vector(y: np.ndarray, sr: int) -> np.ndarray:
    """Returns a 1D numpy array for sklearn – same order every time."""
    d = extract_features(y, sr)
    return np.array(list(d.values()))


def get_feature_names() -> list:
    """Returns the feature name list in the same order as extract_feature_vector."""
    import numpy as np
    dummy = np.zeros(16000)
    d = extract_features(dummy, 16000)
    return list(d.keys())
```

---

## Step 4: Frontend – AudioUploader + SpectrogramViewer

```jsx
// AudioUploader.jsx
export default function AudioUploader({ onUploaded }) {
  const handleFile = async (e) => {
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    const res = await fetch("/audio/upload", { method: "POST", body: formData });
    const data = await res.json();
    onUploaded(data.file_id);
  };
  return <input type="file" accept=".wav,.mp3" onChange={handleFile} />;
}

// SpectrogramViewer.jsx
export default function SpectrogramViewer({ fileId, peaks }) {
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    if (!fileId) return;
    fetch(`/audio/spectrogram?file_id=${fileId}`)
      .then(r => r.json())
      .then(d => setImgSrc(`data:image/png;base64,${d.image_b64}`));
  }, [fileId]);

  return (
    <div className="relative">
      {imgSrc && <img src={imgSrc} className="w-full rounded" alt="spectrogram" />}
      {/* Render peaks overlay as SVG dots if peaks provided */}
    </div>
  );
}
```

---

---

# Member 2 – Classic ML Classifier + Feature Visualization

**Focus:** Task 2. Train, evaluate, and serve the dialect classifier. Visualize the features that drive each decision.

**RULE: Absolutely no neural networks or pretrained AI models. Only scikit-learn.**

## What You Own
- `routers/classify.py`
- `services/classifier.py`
- `notebooks/train_classifier.ipynb`
- `frontend/src/components/ClassifierResult.jsx`

---

## Step 1: Collect Training Data

From the `data/raw/` folder (prepared by Member 0), you need at least:
- 4 dialects × 4 speakers × multiple clips = ~200+ labeled audio files
- Pull from ADI17 dataset (CC BY-SA): https://sls.csail.mit.edu/downloads/adi17/
- Use `scripts/prepare_dataset.py` (Member 0) to generate `all_features.csv`

---

## Step 2: Training Notebook (`notebooks/train_classifier.ipynb`)

```python
import pandas as pd, numpy as np, pickle
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix

# Load feature CSV
df = pd.read_csv("../data/features/all_features.csv")
X = df.drop("label", axis=1).values
y = df["label"].values

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y)

# Scale (SVM needs this)
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test  = scaler.transform(X_test)

# Try SVM
svm = SVC(kernel='rbf', C=10, gamma='scale', probability=True)
svm.fit(X_train, y_train)
print(classification_report(y_test, svm.predict(X_test)))

# Also try Random Forest (gives feature importances)
rf = RandomForestClassifier(n_estimators=200, random_state=42)
rf.fit(X_train, y_train)
print(cross_val_score(rf, X, y, cv=5).mean())

# Save whichever is better
with open("../models/dialect_clf.pkl", "wb") as f:
    pickle.dump({"model": rf, "scaler": scaler}, f)
```

**Visualizations to include in the notebook:**
- Confusion matrix heatmap
- Feature importance bar chart (Random Forest's `feature_importances_`)
- Per-dialect MFCC box plots showing separation
- t-SNE of feature vectors colored by dialect

---

## Step 3: Classifier Service (`services/classifier.py`)

```python
import pickle, numpy as np
from pathlib import Path
from services.feature_extractor import extract_feature_vector, get_feature_names
from services.audio_utils import load_audio

MODEL_PATH = Path("models/dialect_clf.pkl")
_bundle = None

def _load():
    global _bundle
    if _bundle is None:
        with open(MODEL_PATH, "rb") as f:
            _bundle = pickle.load(f)

def predict(y: np.ndarray, sr: int) -> dict:
    _load()
    model  = _bundle["model"]
    scaler = _bundle["scaler"]

    vec = extract_feature_vector(y, sr).reshape(1, -1)
    vec_scaled = scaler.transform(vec)

    dialect    = model.predict(vec_scaled)[0]
    proba      = model.predict_proba(vec_scaled)[0]
    labels     = model.classes_

    # Feature importance (from Random Forest) for explanation panel
    names = get_feature_names()
    importances = model.feature_importances_
    top_features = sorted(zip(names, importances), key=lambda x: -x[1])[:10]

    return {
        "dialect": dialect,
        "probabilities": dict(zip(labels, proba.tolist())),
        "top_features": [{"name": n, "importance": float(v)} for n, v in top_features],
    }
```

---

## Step 4: Classify Router (`routers/classify.py`)

```python
from fastapi import APIRouter
from pathlib import Path
from services.audio_utils import load_audio, trim_silence
from services.classifier import predict

router = APIRouter()
UPLOAD_DIR = Path("uploads")

@router.get("/predict")
def classify_audio(file_id: str):
    path = UPLOAD_DIR / f"{file_id}.wav"
    y, sr = load_audio(str(path))
    y = trim_silence(y)
    return predict(y, sr)
```

---

## Step 5: Feature Visualization on Spectrogram

For **Task 2**, the grader needs to **see** distinguishable features. Your job:

1. After classification, compute per-frame MFCC values and return time-series data.
2. Overlay the top 2–3 features as curves on top of the spectrogram image.
3. Show per-dialect average feature distributions as a side-by-side bar/box chart.

```python
# In classify.py, add this endpoint:
@router.get("/feature-plot")
def feature_plot(file_id: str):
    """Returns base64 image showing MFCC curves over time per dialect."""
    # Load the test file, extract per-frame MFCCs, plot with librosa.display
    # Also load pre-computed per-dialect average MFCCs from training data
    # Plot them side by side to show separation
    pass  # implement using matplotlib, return base64
```

---

## Step 6: Frontend – ClassifierResult

```jsx
// ClassifierResult.jsx
export default function ClassifierResult({ result }) {
  if (!result) return null;
  const { dialect, probabilities, top_features } = result;
  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold">Detected: {dialect}</h2>
      <div className="mt-2">
        {Object.entries(probabilities).map(([d, p]) => (
          <div key={d} className="flex gap-2 items-center">
            <span className="w-12 text-sm">{d}</span>
            <div className="bg-blue-200 h-4 rounded" style={{ width: `${p * 100}%` }} />
            <span className="text-sm">{(p * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <h3 className="mt-4 font-semibold">Top Distinguishing Features</h3>
      {top_features.map(f => (
        <div key={f.name} className="text-sm">{f.name}: {f.importance.toFixed(4)}</div>
      ))}
    </div>
  );
}
```

---

---

# Member 3 – Real-Time Speech-to-Text (STT)

**Focus:** Task 3. Transcribe the audio word-by-word as it plays in the browser. Uses Whisper via HuggingFace – allowed as an "external pretrained model connected via API."

## What You Own
- `routers/transcribe.py`
- `services/stt_service.py`
- `frontend/src/components/TranscriptionPanel.jsx`

---

## Step 1: Install Whisper

```bash
pip install transformers torch torchaudio
# Model: ayoubkirouane/whisper-small-ar on HuggingFace
```

---

## Step 2: STT Service (`services/stt_service.py`)

```python
from transformers import pipeline
import numpy as np, librosa

_asr = None

def _load_asr():
    global _asr
    if _asr is None:
        _asr = pipeline(
            "automatic-speech-recognition",
            model="ayoubkirouane/whisper-small-ar",
            chunk_length_s=30,
            stride_length_s=5,
            return_timestamps="word",   # <-- gives word-level timestamps
        )

def transcribe(audio_path: str) -> list:
    """
    Returns list of { word, start, end } dicts.
    word-level timestamps let the frontend highlight each word in sync with playback.
    """
    _load_asr()
    result = _asr(audio_path)
    chunks = result.get("chunks", [])
    return [
        {"word": c["text"].strip(), "start": c["timestamp"][0], "end": c["timestamp"][1]}
        for c in chunks if c["text"].strip()
    ]
```

---

## Step 3: Transcribe Router with SSE Stream (`routers/transcribe.py`)

Because word-level timestamps are pre-computed by Whisper, you simulate real-time by streaming words timed to the playback clock via Server-Sent Events.

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pathlib import Path
from services.stt_service import transcribe
import asyncio, json

router = APIRouter()
UPLOAD_DIR = Path("uploads")

@router.get("/words")
def get_words(file_id: str):
    """Returns all words with timestamps up front."""
    path = UPLOAD_DIR / f"{file_id}.wav"
    words = transcribe(str(path))
    return {"words": words}

@router.get("/stream")
async def stream_words(file_id: str):
    """SSE stream – emits each word at its real-time offset."""
    path = UPLOAD_DIR / f"{file_id}.wav"
    words = transcribe(str(path))

    async def event_generator():
        prev_time = 0.0
        for w in words:
            delay = (w["start"] or 0) - prev_time
            if delay > 0:
                await asyncio.sleep(delay)
            prev_time = w["start"] or prev_time
            yield f"data: {json.dumps(w)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

## Step 4: Frontend – TranscriptionPanel

```jsx
// TranscriptionPanel.jsx
import { useEffect, useRef, useState } from "react";

export default function TranscriptionPanel({ fileId, currentTime }) {
  const [words, setWords] = useState([]);

  useEffect(() => {
    if (!fileId) return;
    fetch(`/transcribe/words?file_id=${fileId}`)
      .then(r => r.json())
      .then(d => setWords(d.words));
  }, [fileId]);

  return (
    <div className="p-4 bg-gray-50 rounded min-h-24 text-right leading-8" dir="rtl">
      {words.map((w, i) => (
        <span
          key={i}
          className={`mx-1 px-1 rounded transition-colors ${
            currentTime >= w.start && currentTime <= w.end
              ? "bg-yellow-300 font-bold"
              : "text-gray-700"
          }`}
        >
          {w.word}
        </span>
      ))}
    </div>
  );
}
```

**How `currentTime` works:** The `<audio>` element fires `ontimeupdate` continuously. Pass that value as a prop from App.jsx into TranscriptionPanel. Words highlight live.

---

---

# Member 4 – Dialect Translation, TTS & Audio Mixer

**Focus:** Tasks 4 and 5. Translate to another dialect (text + voice) and implement the weighted audio mixer with re-classification.

## What You Own
- `routers/translate.py`
- `services/llm_service.py`
- `services/tts_service.py`
- `routers/audio.py` → `/mix` endpoint (add to Member 1's router)
- `frontend/src/components/DialectTranslator.jsx`
- `frontend/src/components/MixerPanel.jsx`

---

## Step 1: LLM Dialect Translation (`services/llm_service.py`)

Use a local Qwen-8B or Nile-Chat 4B (via `transformers` or `ollama`) for dialect-to-dialect text translation.

```python
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"  # if using ollama locally
MODEL_NAME = "qwen2.5:8b"  # or "aya:8b"

DIALECT_LABELS = {
    "EGY": "المصرية",
    "LAV": "الشامية السورية",
    "GLF": "الخليجية",
    "MAR": "الدارجة المغربية",
    "MSA": "العربية الفصحى",
}

def translate_dialect(text: str, src: str, tgt: str) -> str:
    src_label = DIALECT_LABELS.get(src, src)
    tgt_label = DIALECT_LABELS.get(tgt, tgt)

    prompt = f"""أنت مترجم محترف للهجات العربية. ترجم الجملة التالية من {src_label} إلى {tgt_label} مع الحفاظ على المعنى والأسلوب. أعطني فقط الترجمة بدون أي شرح.

الجملة: {text}
الترجمة:"""

    response = requests.post(OLLAMA_URL, json={
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3}
    })
    return response.json()["response"].strip()
```

**Alternative (if no local GPU):** Use Anthropic API or OpenAI API as a fallback – just swap the HTTP call.

---

## Step 2: TTS Service (`services/tts_service.py`)

Using Habibi-TTS (Apache 2.0 for EGY, MAR, IRQ, MSA):

```python
from transformers import SpeechT5Processor, SpeechT5ForTextToSpeech, SpeechT5HifiGan
import torch, numpy as np, io, soundfile as sf

# Habibi-TTS model map per dialect
HABIBI_MODELS = {
    "EGY": "SWivid/Habibi-TTS",   # Egyptian
    "MAR": "SWivid/Habibi-TTS",   # Moroccan
    "MSA": "SWivid/Habibi-TTS",   # Modern Standard Arabic
}

_models = {}

def _load(dialect: str):
    if dialect not in _models:
        # Load appropriate Habibi-TTS checkpoint for dialect
        # Exact model ID depends on Habibi-TTS repo structure
        from transformers import pipeline
        _models[dialect] = pipeline("text-to-speech", model=HABIBI_MODELS[dialect])
    return _models[dialect]

def synthesize(text: str, dialect: str) -> bytes:
    tts = _load(dialect)
    result = tts(text)
    audio_arr = result["audio"]
    sr = result["sampling_rate"]

    buf = io.BytesIO()
    sf.write(buf, audio_arr, sr, format="WAV")
    buf.seek(0)
    return buf.read()
```

---

## Step 3: Translation Router (`routers/translate.py`)

```python
from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel
from services.llm_service import translate_dialect
from services.tts_service import synthesize

router = APIRouter()

class TranslateRequest(BaseModel):
    text: str
    src_dialect: str
    tgt_dialect: str

@router.post("/text")
def translate_text(req: TranslateRequest):
    translated = translate_dialect(req.text, req.src_dialect, req.tgt_dialect)
    return {"translated_text": translated}

class SynthRequest(BaseModel):
    text: str
    dialect: str

@router.post("/synthesize")
def synthesize_audio(req: SynthRequest):
    audio_bytes = synthesize(req.text, req.dialect)
    return Response(content=audio_bytes, media_type="audio/wav")
```

---

## Step 4: Audio Mixer (Task 5)

Add to `routers/audio.py`:

```python
from pydantic import BaseModel

class MixRequest(BaseModel):
    file_id_a: str
    file_id_b: str
    weight: float   # 0.0 = 100% A,  1.0 = 100% B

@router.post("/mix")
def mix_audio(req: MixRequest):
    import librosa, soundfile as sf, uuid, numpy as np
    from pathlib import Path

    UPLOAD_DIR = Path("uploads")

    y_a, sr = librosa.load(str(UPLOAD_DIR / f"{req.file_id_a}.wav"), sr=16000)
    y_b, _  = librosa.load(str(UPLOAD_DIR / f"{req.file_id_b}.wav"), sr=16000)

    # Match lengths (pad shorter one with zeros)
    max_len = max(len(y_a), len(y_b))
    y_a = np.pad(y_a, (0, max_len - len(y_a)))
    y_b = np.pad(y_b, (0, max_len - len(y_b)))

    # Weighted sum
    w = req.weight
    y_mixed = (1 - w) * y_a + w * y_b

    # Save mixed file
    mixed_id = str(uuid.uuid4())
    out_path = UPLOAD_DIR / f"{mixed_id}.wav"
    sf.write(str(out_path), y_mixed, sr)

    return {"mixed_file_id": mixed_id}
```

**Classification of the mix:** The frontend calls `/classify/predict?file_id={mixed_id}` after mixing. The probabilities will shift toward dialect B as the slider moves right – this is the expected behavior described in Task 5.

---

## Step 5: Frontend – DialectTranslator

```jsx
// DialectTranslator.jsx
const DIALECTS = ["EGY", "LAV", "GLF", "MAR", "MSA"];

export default function DialectTranslator({ transcription, srcDialect }) {
  const [tgt, setTgt] = useState("EGY");
  const [translated, setTranslated] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);

  const translate = async () => {
    const res = await fetch("/translate/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: transcription, src_dialect: srcDialect, tgt_dialect: tgt })
    });
    const d = await res.json();
    setTranslated(d.translated_text);
  };

  const synthesize = async () => {
    const res = await fetch("/translate/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: translated, dialect: tgt })
    });
    const blob = await res.blob();
    setAudioUrl(URL.createObjectURL(blob));
  };

  return (
    <div className="p-4 border rounded space-y-3">
      <label>Target Dialect:
        <select value={tgt} onChange={e => setTgt(e.target.value)} className="ml-2">
          {DIALECTS.map(d => <option key={d}>{d}</option>)}
        </select>
      </label>
      <button onClick={translate} className="bg-blue-500 text-white px-4 py-1 rounded">Translate</button>
      {translated && (
        <>
          <p dir="rtl" className="text-right bg-gray-50 p-2 rounded">{translated}</p>
          <button onClick={synthesize} className="bg-green-500 text-white px-4 py-1 rounded">Synthesize</button>
        </>
      )}
      {audioUrl && <audio controls src={audioUrl} />}
    </div>
  );
}
```

---

## Step 6: Frontend – MixerPanel (Task 5)

```jsx
// MixerPanel.jsx
export default function MixerPanel() {
  const [fileIdA, setFileIdA] = useState(null);
  const [fileIdB, setFileIdB] = useState(null);
  const [weight, setWeight] = useState(0.5);
  const [mixedResult, setMixedResult] = useState(null);
  const [classResult, setClassResult] = useState(null);

  const handleMix = async () => {
    const res = await fetch("/audio/mix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id_a: fileIdA, file_id_b: fileIdB, weight })
    });
    const d = await res.json();
    setMixedResult(d.mixed_file_id);

    // Immediately classify the mix
    const cls = await fetch(`/classify/predict?file_id=${d.mixed_file_id}`);
    setClassResult(await cls.json());
  };

  return (
    <div className="p-4 border rounded space-y-4">
      <h2 className="text-lg font-bold">Dialect Mixer</h2>
      <div className="flex gap-4">
        <AudioUploader label="File A" onUploaded={setFileIdA} />
        <AudioUploader label="File B" onUploaded={setFileIdB} />
      </div>
      <label>
        Weight: A ←{" "}
        <input type="range" min={0} max={1} step={0.01}
          value={weight} onChange={e => setWeight(parseFloat(e.target.value))}
          className="w-48"
        />
        → B ({(weight * 100).toFixed(0)}% B)
      </label>
      <button onClick={handleMix} className="bg-purple-500 text-white px-4 py-1 rounded">Mix & Classify</button>
      {classResult && <ClassifierResult result={classResult} />}
    </div>
  );
}
```

---

---

## Summary Table

| Task (spec) | Member | Key deliverable |
|---|---|---|
| Spectrogram display | 1 | Mel-spectrogram image + upload endpoint |
| Feature extraction pipeline | 1 | `feature_extractor.py` shared module |
| Classic ML classifier | 2 | Trained sklearn model + feature importance plot |
| Feature visualization on spectrogram | 2 | Overlay endpoint + per-dialect comparison chart |
| Real-time STT display | 3 | Whisper word-level timestamps + SSE stream |
| Dialect text translation | 4 | LLM prompt-based dialect conversion |
| Dialect TTS synthesis | 4 | Habibi-TTS audio output per target dialect |
| Weighted audio mixer + re-classify | 4 | `/audio/mix` + classifier called on blend |
| Repo structure + shared utilities | 0 | Folder setup, `audio_utils.py`, API contracts |

---

## Demo Data Requirements (Everyone)

Each member should have **4 dialects × 4 speakers = 16 audio clips** ready at `data/raw/`:

- Pull from ADI17 dataset or record manually
- Each clip: ~30 seconds, clean speech (no music)
- Name format: `EGY_speaker1.wav`, `LAV_speaker2.wav`, etc.
- Also prepare **example pairs** for Task 5 (e.g., EGY + GLF to demo the slider)

---

## Running the Project

```bash
# Terminal 1 – Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 – Frontend
cd frontend
npm run dev

# Terminal 3 – LLM (if using Ollama)
ollama serve
ollama pull qwen2.5:8b
```
