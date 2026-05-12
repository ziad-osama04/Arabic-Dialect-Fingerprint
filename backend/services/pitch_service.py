"""
Pitch Analysis Service
========================
Extracts fundamental frequency (F0) of an audio file to determine the speaker's pitch.
This allows us to match the synthesized TTS voice tone to the original speaker.
"""

import numpy as np
import librosa
import logging

logger = logging.getLogger(__name__)

def estimate_pitch(y: np.ndarray, sr: int) -> dict:
    """
    Estimate the median fundamental frequency (F0) of an audio signal.
    Uses librosa.pyin which is robust for speech pitch tracking.
    
    Returns:
        dict: containing 'median_pitch' in Hz, and 'gender_guess'.
    """
    logger.info("Estimating pitch using librosa.pyin...")
    
    # Trim silence
    y, _ = librosa.effects.trim(y, top_db=30)
    
    # pyin is computationally intensive, so we downsample and take a short slice (e.g. 3 seconds)
    target_sr = 16000
    if sr != target_sr:
        y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
        sr = target_sr
        
    # Take middle 3 seconds if longer
    duration = len(y) / sr
    if duration > 3.0:
        start = int((duration - 3.0) / 2 * sr)
        y = y[start:start + int(3.0 * sr)]

    # F0 range typical for human speech (50Hz to 400Hz)
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y, 
        fmin=librosa.note_to_hz('C2'), 
        fmax=librosa.note_to_hz('G5'), 
        sr=sr
    )
    
    # Filter only voiced frames
    if f0 is not None:
        voiced_f0 = f0[voiced_flag]
        if len(voiced_f0) > 0:
            median_pitch = float(np.median(voiced_f0))
            min_pitch = float(np.min(voiced_f0))
            max_pitch = float(np.max(voiced_f0))
            std_pitch = float(np.std(voiced_f0))
            
            # Extract spectral features for "Tone" matching
            # Spectral centroid indicates where the "center of mass" of the spectrum is (brightness)
            S = np.abs(librosa.stft(y))
            centroid = librosa.feature.spectral_centroid(S=S, sr=sr)
            mean_centroid = float(np.mean(centroid))
            
            # Simple gender heuristic based on pitch
            # Males typically 85-180Hz, Females typically 165-255Hz
            gender_guess = "F" if median_pitch > 165 else "M"
            
            return {
                "median_pitch": round(median_pitch, 1),
                "min_pitch": round(min_pitch, 1),
                "max_pitch": round(max_pitch, 1),
                "std_pitch": round(std_pitch, 1),
                "spectral_centroid": round(mean_centroid, 1),
                "gender_guess": gender_guess,
                "detected": True
            }
            
    return {
        "median_pitch": 0.0,
        "min_pitch": 0.0,
        "max_pitch": 0.0,
        "std_pitch": 0.0,
        "spectral_centroid": 0.0,
        "gender_guess": "M",
        "detected": False
    }


def apply_tone_filter(audio_bytes: bytes, target_centroid: float) -> bytes:
    """
    Apply a simple spectral filter to make audio brightness match a target centroid.
    This acts like an automatic Equalizer.
    """
    import io
    import soundfile as sf
    from scipy import signal

    try:
        # Load audio from bytes
        data, sr = librosa.load(io.BytesIO(audio_bytes), sr=None)
        
        # Analyze current centroid
        current_centroid = float(np.mean(librosa.feature.spectral_centroid(y=data, sr=sr)))
        
        if current_centroid == 0:
            return audio_bytes

        # Calculate ratio
        # If target > current, we want to boost highs (increase brightness)
        # If target < current, we want to boost lows (increase warmth)
        ratio = target_centroid / current_centroid
        
        # Clamp ratio to avoid extreme distortion
        ratio = max(0.5, min(2.0, ratio))
        
        logger.info(f"Tone Matching: Current={current_centroid:.1f}, Target={target_centroid:.1f}, Ratio={ratio:.2f}")

        # Simple 3-band EQ approach
        # Low Shelf (< 500Hz), Mid, High Shelf (> 3000Hz)
        if ratio > 1.1:
            # Boost highs (High-pass filter blend or High-shelf)
            # For simplicity, let's use a basic tilt or shelving filter
            # Here we just apply a simple pre-emphasis to brighten
            data = librosa.effects.preemphasis(data, coef=0.5 * (ratio - 1))
        elif ratio < 0.9:
            # Boost lows / Cut highs
            # Low-pass filter
            b, a = signal.butter(2, 0.5, 'low')
            data = signal.filtfilt(b, a, data)

        # Normalize to prevent clipping
        data = librosa.util.normalize(data)

        # Export back to bytes (WAV)
        buf = io.BytesIO()
        sf.write(buf, data, sr, format='WAV')
        buf.seek(0)
        return buf.read()
    except Exception as e:
        logger.error(f"Tone matching failed: {e}")
        return audio_bytes
