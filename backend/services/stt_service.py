import os
import logging
from pathlib import Path
from faster_whisper import WhisperModel

from services.audio_utils import UPLOAD_DIR

# Setup DLL paths for CUDA libraries on Windows
def _setup_cuda_dlls():
    # Attempt to find CUDA DLLs if installed via pip in a venv
    try:
        import nvidia
        nvidia_path = Path(nvidia.__file__).resolve().parent
        cuda_bin_paths = list(nvidia_path.glob("**/bin"))
        for path in cuda_bin_paths:
            path_str = str(path)
            if path_str not in os.environ["PATH"]:
                os.environ["PATH"] = path_str + os.pathsep + os.environ["PATH"]
            if hasattr(os, "add_dll_directory"):
                try:
                    os.add_dll_directory(path_str)
                except Exception:
                    pass
    except ImportError:
        pass

_setup_cuda_dlls()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Singleton for the model
_model = None

def get_model():
    global _model
    if _model is None:
        try:
            logger.info("Loading Faster-Whisper model (small)...")
            # device="auto" will use CUDA if available, otherwise CPU.
            _model = WhisperModel("small", device="auto", compute_type="float16")
            logger.info("Faster-Whisper model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Faster-Whisper model on GPU: {e}")
            try:
                logger.info("Falling back to CPU (int8)...")
                _model = WhisperModel("small", device="cpu", compute_type="int8")
                logger.info("Faster-Whisper model loaded on CPU.")
            except Exception as e2:
                logger.error(f"Critical error: Could not load model even on CPU: {e2}")
                _model = None
    return _model

def transcribe(audio_path: str | Path) -> list[dict]:
    """Transcribe audio using faster-whisper and return words with real timestamps."""
    audio_path = str(audio_path)
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
    
    model = get_model()
    if model is None:
        raise Exception("Transcription model is not initialized.")

    logger.info(f"Transcribing audio file: {audio_path}")
    
    # transcribe() returns a generator of segments
    # beam_size=5 is a good balance for speed/accuracy
    segments, info = model.transcribe(audio_path, beam_size=5, word_timestamps=True)
    
    logger.info(f"Detected language: {info.language} ({info.language_probability:.2f})")

    timestamped_words = []
    
    for segment in segments:
        if segment.words:
            for word in segment.words:
                timestamped_words.append({
                    "word": word.word.strip(),
                    "start": round(word.start, 2),
                    "end": round(word.end, 2)
                })
        else:
            # Fallback if word timestamps fail
            words = segment.text.strip().split()
            duration = segment.end - segment.start
            word_duration = duration / len(words) if words else 0
            for i, w in enumerate(words):
                timestamped_words.append({
                    "word": w,
                    "start": round(segment.start + (i * word_duration), 2),
                    "end": round(segment.start + ((i + 1) * word_duration), 2)
                })
    
    return timestamped_words
