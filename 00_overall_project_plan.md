# Task 5 - Arabic Dialect Fingerprint Overall Plan

## Goal

Build a web application that accepts Arabic speech audio, visualizes its spectrogram, identifies the spoken dialect using classic machine learning only, explains the acoustic features behind the decision, shows word-level transcription while the audio plays, converts the spoken content into another dialect, and supports weighted mixing of two audio files followed by re-classification.

## Selected Dialects

Use four dialect groups for the classifier and demo set:

| Code | Dialect | Demo requirement |
|---|---|---|
| EGY | Egyptian Arabic | 4 different voices, around 30 seconds each |
| LAV | Levantine / Syrian-Lebanese Arabic | 4 different voices, around 30 seconds each |
| GLF | Gulf / Khaleeji Arabic | 4 different voices, around 30 seconds each |
| MAR | Moroccan Darija / Maghrebi Arabic | 4 different voices, around 30 seconds each |

Minimum demo inventory: 16 clean clips total. Training should use more clips when possible, but the live demo must clearly include 4 dialects x 4 voices.

## Key Rule

The dialect classifier must use classic signal processing features plus classic machine learning only.

Allowed for classification:
- MFCC, delta MFCC, chroma, spectral centroid, rolloff, spectral contrast, zero crossing rate, RMS, tempo, pitch/prosody statistics, formant-like spectral summaries, spectrogram peak statistics.
- scikit-learn models such as SVM, Random Forest, Logistic Regression, KNN, Gradient Boosting, Gaussian Naive Bayes.

Not allowed for classification:
- CNN, RNN, Transformer, wav2vec, Whisper embeddings, pretrained dialect classifiers, deep learning networks.

Allowed helper systems:
- STT may use Whisper or another pretrained ASR engine.
- Dialect text conversion may use an external LLM API or local LLM.
- TTS may use a pretrained Arabic TTS engine.

## Missing Items Found In The Current Pipeline

The existing `arabic_dialect_pipeline.md` already covers the main architecture, endpoints, tools, and member split. These items should be added or made more explicit for a stronger submission:

1. Demo data manifest: exact list of the 16 required clips, speaker IDs, dialect labels, duration, transcript, and source/license.
2. Feature proof: charts that compare dialects directly, not only feature names. The grader must see clear distinguishable differences.
3. Classifier evidence: confusion matrix, accuracy/F1, cross-validation result, and saved model version.
4. Explanation output: the app should show top features, per-dialect probability bars, and at least one visual overlay or comparison chart.
5. Transcription synchronization: words need timestamps and must highlight according to the audio playback clock.
6. Dialect conversion examples: prepare examples for every source-target path used in the demo, including fallback when a TTS voice is unavailable.
7. Mixer expected behavior: document how probabilities should change at 0%, 25%, 50%, 75%, and 100% slider positions.
8. Integration checklist: one complete demo route from upload to spectrogram to classify to transcript to dialect conversion to mixing.
9. Acceptance checklist: map every sentence in the task statement to a visible feature in the app.

## Final System Flow

1. User uploads one audio file.
2. Backend stores the file and returns `file_id`, duration, and metadata.
3. Backend computes and returns a spectrogram image plus optional feature overlays.
4. Backend extracts classic acoustic features.
5. Classifier predicts dialect probabilities.
6. UI displays detected dialect, probabilities, and governing feature visualization.
7. ASR helper creates word-level timestamps.
8. UI highlights words in real time while the audio plays.
9. User chooses a target dialect.
10. Dialect conversion helper converts text from source dialect to target dialect.
11. TTS helper synthesizes the converted text in the target dialect or documented fallback voice.
12. User can upload two files, control the weighted average slider, generate a mixed audio file, and classify the mixed result.

## Recommended Folder Structure

```text
arabic-dialect-app/
  backend/
    main.py
    routers/
      audio.py
      classify.py
      transcribe.py
      translate.py
    services/
      audio_utils.py
      feature_extractor.py
      classifier.py
      stt_service.py
      llm_service.py
      tts_service.py
    models/
      dialect_clf.pkl
      feature_names.json
      training_report.json
    data/
      raw/
        EGY/
        LAV/
        GLF/
        MAR/
      features/
        all_features.csv
        dialect_feature_stats.csv
      demo_manifest.csv
    notebooks/
      train_classifier.ipynb
    requirements.txt
  frontend/
    src/
      App.jsx
      api/client.js
      components/
        AudioUploader.jsx
        AudioPlayer.jsx
        SpectrogramViewer.jsx
        ClassifierResult.jsx
        FeatureExplanation.jsx
        TranscriptionPanel.jsx
        DialectTranslator.jsx
        MixerPanel.jsx
  scripts/
    prepare_dataset.py
    validate_demo_data.py
  docs/
    screenshots/
  README.md
```

## API Contract

| Endpoint | Method | Input | Output | Owner |
|---|---|---|---|---|
| `/audio/upload` | POST | audio file | `{file_id, duration, sample_rate}` | Member 1 |
| `/audio/file/{file_id}` | GET | file id | audio bytes | Member 1 |
| `/audio/spectrogram` | GET | `file_id` | `{image_b64, overlay_points}` | Member 1 |
| `/audio/mix` | POST | `{file_id_a, file_id_b, weight}` | `{mixed_file_id}` | Member 4 with Member 1 |
| `/classify/predict` | GET | `file_id` | `{dialect, probabilities, top_features}` | Member 2 |
| `/classify/explain` | GET | `file_id` | `{plot_b64, feature_values, nearest_dialects}` | Member 2 |
| `/transcribe/words` | GET | `file_id` | `{words:[{word,start,end}]}` | Member 3 |
| `/transcribe/stream` | GET SSE | `file_id` | stream of timed words | Member 3 |
| `/translate/text` | POST | `{text, src_dialect, tgt_dialect}` | `{translated_text}` | Member 4 |
| `/translate/synthesize` | POST | `{text, dialect}` | WAV audio | Member 4 |

## Member Distribution

| Member | Role | Main output |
|---|---|---|
| Member 0 | Architect and integrator | Repo structure, shared contracts, integration, README, demo checklist |
| Member 1 | Audio upload, playback, spectrogram, feature extraction | Audio endpoints, spectrogram UI, shared feature extractor |
| Member 2 | Classic ML classifier and explainability | Training notebook, model, prediction API, feature visualization |
| Member 3 | Real-time transcription | ASR wrapper, timestamp API/SSE, live word highlighting UI |
| Member 4 | Dialect conversion, TTS, mixer | Translation/TTS APIs, target dialect UI, weighted mixer and mixed classification |

## Demo Data Manifest

Create `backend/data/demo_manifest.csv` with these columns:

```csv
file_name,dialect,speaker_id,duration_seconds,transcript_ar,source,license,notes
EGY_spk01.wav,EGY,EGY_spk01,30,...,manual_or_ADI17,...
LAV_spk01.wav,LAV,LAV_spk01,30,...,manual_or_ADI17,...
GLF_spk01.wav,GLF,GLF_spk01,30,...,manual_or_ADI17,...
MAR_spk01.wav,MAR,MAR_spk01,30,...,manual_or_ADI17,...
```

Acceptance target:
- 4 rows per dialect.
- Each clip around 30 seconds.
- Different voice per row.
- Transcript available for every demo clip.
- License/source recorded.

## Feature Visualization Requirement

The app must display at least three visual explanations:

1. Spectrogram with highlighted time-frequency peaks or selected frames.
2. Probability bars for the four dialects.
3. Feature comparison chart showing the uploaded file against dialect averages, such as MFCC mean, spectral contrast, centroid, rolloff, ZCR, and RMS.

The classifier should also return the top 5 to 10 governing features. For Random Forest this can use feature importances. For SVM this can use permutation importance or distance-based explanation.

## Mixer Requirement

The mixer takes two uploaded files:

```text
mixed_signal = (1 - weight) * file_a + weight * file_b
```

Expected demo table:

| Slider weight | Expected classifier behavior |
|---|---|
| 0.00 | Closest to file A dialect |
| 0.25 | Mostly file A, small shift toward file B |
| 0.50 | Mixed probabilities, often top two are A and B |
| 0.75 | Mostly file B, still some file A probability |
| 1.00 | Closest to file B dialect |

Normalize the mixed audio after summation to avoid clipping.

## End-To-End Demo Script

1. Open the web app.
2. Upload one Egyptian sample.
3. Play the sample.
4. Show spectrogram.
5. Show real-time highlighted transcription.
6. Click classify and show Egyptian probability plus top features.
7. Open feature explanation plot and compare against other dialect averages.
8. Convert the text to Levantine.
9. Play synthesized Levantine output.
10. Upload Egyptian and Gulf samples in the mixer.
11. Move slider through 0%, 50%, and 100%.
12. Show classification probabilities changing with the weight.

## Acceptance Checklist

| Task statement requirement | Visible project evidence |
|---|---|
| Open a 30 sec Arabic voice file | Upload UI, audio player, backend upload endpoint |
| Visualize spectrogram | SpectrogramViewer component and `/audio/spectrogram` |
| 4 dialects, 4 voices each | `demo_manifest.csv` plus files in `data/raw` |
| Classic ML only for dialect ID | Training notebook using scikit-learn only |
| Visualize governing features | Feature overlay, feature chart, top feature list |
| Display pronounced words in real time | word timestamps and playback highlighting |
| Choose another dialect to hear same file | target dialect selector, translated text, TTS player |
| Change tones and words | dialect text conversion plus dialect TTS/fallback voice |
| Examples illustrating all possibilities | source-target example table and demo samples |
| Mix two files with weighted average | MixerPanel slider and `/audio/mix` endpoint |
| Classify the mixed result | classifier called on `mixed_file_id` |
| Output mix reflects slider weights | probability trend table shown in UI or README |

## Final Deliverables

- Working frontend and backend.
- 16 demo clips with manifest.
- Trained classic ML model and training report.
- Feature visualization screenshots.
- README with setup and demo script.
- Member documentation files:
  - `member0_architecture_integration.md`
  - `member1_audio_spectrogram_features.md`
  - `member2_classic_ml_classifier_explainability.md`
  - `member3_realtime_stt.md`
  - `member4_dialect_conversion_mixer.md`

