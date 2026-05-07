# Arabic Dialect Fingerprint

Task 5 web application for Arabic dialect detection from speech audio.

The app will:

1. Open an Arabic voice file around 30 seconds.
2. Display the audio spectrogram.
3. Identify the dialect using classic machine learning only.
4. Show the acoustic features that governed the decision.
5. Display spoken words in real time while the audio plays.
6. Convert the transcript to another dialect and synthesize audio.
7. Mix two audio files with a weighted slider and classify the mixed result.

## Dialects

The project targets four dialect groups:

| Code | Dialect |
|---|---|
| EGY | Egyptian Arabic |
| LAV | Levantine / Syrian-Lebanese Arabic |
| GLF | Gulf / Khaleeji Arabic |
| MAR | Moroccan Darija / Maghrebi Arabic |

The demo must include 4 different voices per dialect, for 16 total demo clips.

## Team Ownership

| Member | Responsibility |
|---|---|
| Member 0 | Architecture, repo setup, integration, README, demo manifest |
| Member 1 | Audio upload, playback, spectrogram, feature extraction |
| Member 2 | Classic ML classifier, training, evaluation, explainability |
| Member 3 | Real-time speech-to-text and word highlighting |
| Member 4 | Dialect text conversion, TTS, weighted audio mixer |

Detailed plans are in:

- `00_overall_project_plan.md`
- `member0_architecture_integration.md`
- `member1_audio_spectrogram_features.md`
- `member2_classic_ml_classifier_explainability.md`
- `member3_realtime_stt.md`
- `member4_dialect_conversion_mixer.md`

## Project Structure

```text
backend/
  main.py
  routers/
  services/
  models/
  data/
    raw/
      EGY/
      LAV/
      GLF/
      MAR/
    features/
    demo_manifest.csv
frontend/
  src/
    api/
    components/
scripts/
  prepare_dataset.py
  validate_demo_data.py
docs/
  screenshots/
```

## Classic ML Rule

Dialect classification must use only classic signal-processing features and scikit-learn style models.

Allowed classification features:

- MFCC and delta MFCC statistics.
- Spectral centroid, rolloff, bandwidth, and contrast.
- Zero crossing rate.
- RMS energy.
- Pitch/prosody/rhythm statistics.
- Spectrogram peak/fingerprint statistics.

Allowed classification models:

- Random Forest.
- SVM.
- Logistic Regression.
- KNN.
- Gradient Boosting.
- Other classic scikit-learn estimators.

Do not use deep learning, Whisper embeddings, wav2vec embeddings, pretrained dialect classifiers, CNNs, RNNs, or Transformers for dialect classification.

Pretrained helpers are allowed for STT, dialect text conversion, and TTS only.

## Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend health checks:

```text
http://localhost:8000/health
http://localhost:8000/docs
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Default frontend:

```text
http://localhost:5173
```

Set a different backend URL with:

```bash
set VITE_API_BASE_URL=http://localhost:8000
```

## Demo Data Setup

Place audio files here:

```text
backend/data/raw/EGY/
backend/data/raw/LAV/
backend/data/raw/GLF/
backend/data/raw/MAR/
```

Update:

```text
backend/data/demo_manifest.csv
```

Required manifest fields:

- `file_name`
- `dialect`
- `speaker_id`
- `duration_seconds`
- `transcript_ar`
- `source`
- `license`
- `notes`

Validate demo readiness:

```bash
python scripts/validate_demo_data.py
```

The validator is expected to fail until real audio files, transcripts, sources, and licenses are added.

## Feature Dataset Preparation

After Member 1 implements `backend/services/feature_extractor.py`, run:

```bash
python scripts/prepare_dataset.py
```

Output:

```text
backend/data/features/all_features.csv
```

Member 2 uses this file to train the classic ML classifier.

## API Contract

| Endpoint | Owner | Purpose |
|---|---|---|
| `POST /audio/upload` | Member 1 | Upload audio and return `file_id` |
| `GET /audio/file/{file_id}` | Member 1 | Serve uploaded audio |
| `GET /audio/spectrogram` | Member 1 | Return spectrogram image |
| `POST /audio/mix` | Member 4 | Create weighted audio mix |
| `GET /classify/predict` | Member 2 | Return dialect probabilities |
| `GET /classify/explain` | Member 2 | Return feature explanation |
| `GET /transcribe/words` | Member 3 | Return timestamped words |
| `GET /transcribe/stream` | Member 3 | Stream timestamped words |
| `POST /translate/text` | Member 4 | Convert transcript to target dialect |
| `POST /translate/synthesize` | Member 4 | Return target dialect speech |

## Final Demo Script

1. Start backend and frontend.
2. Upload an Egyptian demo file.
3. Play audio and show live word highlighting.
4. Show spectrogram.
5. Run classifier and show Egyptian probability.
6. Show top governing features and dialect comparison chart.
7. Convert transcript to Levantine.
8. Play synthesized target dialect audio.
9. Upload Egyptian and Gulf files in the mixer.
10. Test slider at 0%, 50%, and 100%.
11. Show classifier probabilities shifting with the mix.

## Current Member 0 Status

Implemented:

- Backend skeleton and router registration.
- Shared audio utility module.
- Placeholder module health routes.
- Demo manifest template.
- Demo validation script.
- Dataset preparation script.
- React/Vite frontend shell.
- Shared frontend API client.
- README and planning docs.

Remaining work belongs to Members 1 to 4 according to their member files.

