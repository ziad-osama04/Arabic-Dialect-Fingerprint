# Arabic Dialect Fingerprint

A high-fidelity workstation for Arabic dialect identification, acoustic visualization, and explainable AI analysis. This project uses classic signal processing (no deep learning for classification) to distinguish between four major Arabic dialect groups.

## 🌍 Supported Dialects

We have transitioned from country-specific labeling to robust regional groupings to ensure higher classification accuracy and better generalization:

| Code | Dialect Group | Region |
|---|---|---|
| **EGY** | Egyptian | Egypt |
| **LEV** | Levantine | Lebanon, Syria, Jordan, Palestine |
| **GLF** | Gulf | KSA, UAE, Kuwait, Qatar, Oman, Bahrain |
| **MAG** | Maghrebi | Morocco, Algeria, Tunisia, Libya |

## 🚀 Key Features

1.  **Acoustic Pipeline**: 
    *   Upload 5–30s audio files.
    *   Interactive Mel-spectrogram with **Acoustic Fingerprint** peak detection (Top 100 peaks).
    *   Real-time feature evolution tracking (MFCC, Centroid, RMS).
2.  **ML Classifier**:
    *   State-of-the-art **SVM Classifier** (~86% accuracy).
    *   SHAP-based **Explainability**: Understand *why* the model chose a dialect.
    *   Dialect Similarity Radar: Comparison against regional acoustic averages.
3.  **Data Engine**:
    *   Asynchronous downloader for the **MADIS5** dataset.
    *   Automatic feature extraction and speaker-aware training (no identity leakage).
4.  **Mixed Mode** (Member 4): Weighted audio mixing with real-time classification shift.

## 🛠️ Tech Stack

*   **Backend**: Python, FastAPI, Librosa, Scikit-learn, SHAP.
*   **Frontend**: React, Vite, Vanilla CSS (Premium Dark Mode), Lucide Icons.
*   **Dataset**: `badrex/MADIS5-spoken-arabic-dialects` (Hugging Face).

## 🏃 Getting Started

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

### 2. Data Preparation (Optional)
If you want to retrain the models or download more data:
```bash
# 1. Download MADIS5 data (500 samples per dialect)
python backend/Audios/download_async.py

# 2. Extract features
python scripts/prepare_dataset.py

# 3. Train models (SVM, RF, KNN)
python scripts/train_classifier.py
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

## 📊 Classification Pipeline

Our "Classic ML" rule ensures the model remains lightweight and interpretable:
*   **Features**: 13 MFCCs + Deltas, Spectral Centroid, Rolloff, Contrast, Zero Crossing Rate, RMS, Pitch/Prosody, and Peak Density.
*   **Models**: Best performing is **SVM (RBF Kernel)** with balanced class weights.
*   **Validation**: Uses `GroupShuffleSplit` to ensure that audio from a speaker in the training set never appears in the test set.

## 🏗️ Project Structure

```text
Arabic-Dialect-Fingerprint/
├── backend/
│   ├── Audios/        # Raw WAV files (EGY, GLF, LEV, MAG)
│   ├── data/          # Feature CSVs and temporary uploads
│   ├── models/        # Pickled models, scalers, and SHAP artifacts
│   ├── routers/       # API Endpoints (audio, classify, etc.)
│   └── services/      # Core logic (feature extraction, inference)
├── frontend/
│   └── src/
│       ├── components/ # UI Widgets (Spectrogram, Classifier, etc.)
│       └── api/        # Client-side API wrappers
├── scripts/
│   ├── prepare_dataset.py
│   ├── train_classifier.py
│   └── repopulate_demos.py
└── Downloaded Test Samples/ # Quick-load clips for the UI
```

## 👥 Team Ownership

| Member | Focus | Status |
|---|---|---|
| **Member 1** | Audio, Spectrograms, Features | ✅ Integrated |
| **Member 2** | ML Classifier & Explainability | ✅ Integrated |
| **Member 3** | Real-time STT | ⏳ In Progress |
| **Member 4** | Translation & Audio Mixing | ⏳ In Progress |

---
*Created for the Acoustic Fingerprinting Project — May 2026*


