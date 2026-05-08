import librosa
import numpy as np


def _compute_mel_peaks(y: np.ndarray, sr: int, top_n: int = 100) -> list:
    """Internal helper – returns peaks from mel spectrogram. Defined first to avoid forward reference."""
    S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=8000)
    S_dB = librosa.power_to_db(S, ref=np.max)
    peaks_mask = librosa.util.localmax(S_dB)
    freq_idxs, time_idxs = np.where(peaks_mask)
    strengths = S_dB[freq_idxs, time_idxs]
    valid = strengths > -60
    freq_idxs, time_idxs, strengths = freq_idxs[valid], time_idxs[valid], strengths[valid]
    top = np.argsort(strengths)[::-1][:top_n]
    n_freq, n_time = S_dB.shape
    return [
        {
            "time_pct": float(time_idxs[i] / (n_time - 1)),
            "freq_pct": float(freq_idxs[i] / (n_freq - 1)),
            "strength": float((strengths[i] + 80) / 80)
        }
        for i in top
    ]


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
        features[f"mfcc_{i}_std"] = float(np.std(coef))

    # --- Delta MFCCs (captures speech dynamics) ---
    delta_mfcc = librosa.feature.delta(mfcc)
    for i, coef in enumerate(delta_mfcc):
        features[f"delta_mfcc_{i}_mean"] = float(np.mean(coef))
        features[f"delta_mfcc_{i}_std"] = float(np.std(coef))

    # --- Spectral Centroid (brightness of the sound) ---
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    features["centroid_mean"] = float(np.mean(centroid))
    features["centroid_std"] = float(np.std(centroid))

    # --- Spectral Rolloff (frequency below which 85% of energy sits) ---
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)
    features["rolloff_mean"] = float(np.mean(rolloff))
    features["rolloff_std"] = float(np.std(rolloff))

    # --- Spectral Bandwidth ---
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    features["bandwidth_mean"] = float(np.mean(bandwidth))
    features["bandwidth_std"] = float(np.std(bandwidth))

    # --- Spectral Contrast (difference between peaks and valleys per sub-band) ---
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr, n_bands=6)
    for i, band in enumerate(contrast):
        features[f"contrast_{i}_mean"] = float(np.mean(band))

    # --- Zero Crossing Rate (roughness / voicing) ---
    zcr = librosa.feature.zero_crossing_rate(y)
    features["zcr_mean"] = float(np.mean(zcr))
    features["zcr_std"] = float(np.std(zcr))

    # --- RMS Energy (loudness envelope) ---
    rms = librosa.feature.rms(y=y)
    features["rms_mean"] = float(np.mean(rms))
    features["rms_std"] = float(np.std(rms))

    # --- Tempo (speech rhythm differs per dialect) ---
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    features["tempo"] = float(tempo)

    # --- Pause Ratio (fraction of near-silence frames) ---
    # Helps capture speaking rhythm differences between dialects
    rms_frames = librosa.feature.rms(y=y)[0]
    silence_threshold = 0.01 * np.max(rms_frames) if np.max(rms_frames) > 0 else 1e-6
    features["pause_ratio"] = float(np.mean(rms_frames < silence_threshold))

    # --- Pitch (Prosody/Tone) ---
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    # Extract mean pitch where it's confident
    mask = magnitudes > np.percentile(magnitudes, 90)
    if np.any(mask):
        pitch_vals = pitches[mask]
        features["pitch_mean"] = float(np.mean(pitch_vals[pitch_vals > 0])) if np.any(pitch_vals > 0) else 0.0
        features["pitch_std"] = float(np.std(pitch_vals[pitch_vals > 0])) if np.any(pitch_vals > 0) else 0.0
        features["pitch_range"] = float(np.ptp(pitch_vals[pitch_vals > 0])) if np.any(pitch_vals > 0) else 0.0
    else:
        features["pitch_mean"] = 0.0
        features["pitch_std"] = 0.0
        features["pitch_range"] = 0.0

    # --- Peak Fingerprint Statistics (Shazam-like) ---
    peaks = _compute_mel_peaks(y, sr, top_n=100)
    features["peak_count"] = float(len(peaks))
    if peaks:
        strengths = [p["strength"] for p in peaks]
        duration = len(y) / sr
        features["peak_strength_mean"] = float(np.mean(strengths))
        features["peak_strength_std"] = float(np.std(strengths))
        features["peak_density"] = float(len(peaks) / max(duration, 1.0))  # peaks per second
        features["peak_freq_spread"] = float(np.std([p["freq_pct"] for p in peaks]))
        features["peak_time_spread"] = float(np.std([p["time_pct"] for p in peaks]))
    else:
        features["peak_strength_mean"] = 0.0
        features["peak_strength_std"] = 0.0
        features["peak_density"] = 0.0
        features["peak_freq_spread"] = 0.0
        features["peak_time_spread"] = 0.0

    return features


def extract_feature_vector(y: np.ndarray, sr: int) -> np.ndarray:
    """Returns a 1D numpy array for sklearn – same order every time."""
    d = extract_features(y, sr)
    # Sorting keys ensures deterministic order
    return np.array([d[k] for k in sorted(d.keys())])


def get_feature_names() -> list[str]:
    """Returns the feature name list in the same order as extract_feature_vector."""
    # Dummy signal to get consistent keys
    dummy = np.zeros(16000)
    d = extract_features(dummy, 16000)
    return sorted(d.keys())


def extract_frame_features(y: np.ndarray, sr: int) -> dict:
    """
    Returns time-series features for overlays and explanations.
    Useful for visualizing feature changes over the spectrogram.
    """
    # Use a hop_length that matches typical spectrogram displays
    hop_length = 512
    
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop_length)
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)
    rms = librosa.feature.rms(y=y, hop_length=hop_length)
    
    times = librosa.times_like(mfcc, sr=sr, hop_length=hop_length)
    
    return {
        "times": times.tolist(),
        "mfcc_0": mfcc[0].tolist(),   # Energy/timbre
        "mfcc_1": mfcc[1].tolist(),   # Spectral tilt
        "mfcc_2": mfcc[2].tolist(),   # 2nd formant region
        "centroid": centroid[0].tolist(),
        "rms": rms[0].tolist(),
        "zcr": librosa.feature.zero_crossing_rate(y, hop_length=hop_length)[0].tolist()
    }


def find_spectrogram_peaks(y: np.ndarray, sr: int, top_n: int = 50, use_mel: bool = True) -> list[dict]:
    """
    Find local peaks in the spectrogram for the 'fingerprint' overlay.
    If use_mel is True, it aligns with Mel-scaled displays.
    Returns list of {'time_pct': float, 'freq_pct': float, 'strength': float}
    where pct values are 0-1 for easy frontend overlay.
    """
    if use_mel:
        # Match the Mel spectrogram settings used in the router
        S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=8000)
        S_dB = librosa.power_to_db(S, ref=np.max)
    else:
        S = np.abs(librosa.stft(y))
        S_dB = librosa.amplitude_to_db(S, ref=np.max)
        
    # Local maxima filter
    peaks = librosa.util.localmax(S_dB)
    
    # Get indices of peaks
    freq_idxs, time_idxs = np.where(peaks)
    
    # Get strengths (using dB for better relative scaling)
    strengths = S_dB[freq_idxs, time_idxs]
    
    # Sort by strength and take top_n
    # We use a threshold to ignore very quiet peaks
    threshold = -60 # dB
    valid_mask = strengths > threshold
    freq_idxs = freq_idxs[valid_mask]
    time_idxs = time_idxs[valid_mask]
    strengths = strengths[valid_mask]

    top_idxs = np.argsort(strengths)[::-1][:top_n]
    
    peak_list = []
    n_freq_bins = S_dB.shape[0]
    n_time_frames = S_dB.shape[1]
    
    for idx in top_idxs:
        peak_list.append({
            "time_pct": float(time_idxs[idx] / (n_time_frames - 1)),
            "freq_pct": float(freq_idxs[idx] / (n_freq_bins - 1)),
            "strength": float((strengths[idx] + 80) / 80) # Normalize -80dB..0dB to 0..1
        })
        
    return peak_list
