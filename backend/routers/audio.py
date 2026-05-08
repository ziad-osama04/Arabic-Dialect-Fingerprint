import base64
import io
import uuid
from pathlib import Path
import librosa
import librosa.display
import matplotlib.pyplot as plt
import numpy as np
from fastapi import APIRouter, File, UploadFile, HTTPException, Response
from pydantic import BaseModel

from services import audio_utils
from services.feature_extractor import find_spectrogram_peaks

router = APIRouter()
UPLOAD_DIR = audio_utils.UPLOAD_DIR


class MixRequest(BaseModel):
    file_id_a: str
    file_id_b: str
    weight: float  # 0.0 means all A, 1.0 means all B


@router.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    """
    Upload an audio file, normalize it, and store it as a WAV.
    Returns metadata including file_id and duration.
    """
    if not file.filename.lower().endswith(('.wav', '.mp3', '.m4a')):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload WAV or MP3.")

    file_id = str(uuid.uuid4())
    temp_path = UPLOAD_DIR / f"{file_id}_temp"
    
    try:
        # Save uploaded file temporarily
        with open(temp_path, "wb") as f:
            f.write(await file.read())
        
        # Load and normalize using shared utils
        # This will fail for corrupt files
        try:
            y, sr = audio_utils.load_audio(temp_path)
        except Exception:
            raise HTTPException(status_code=400, detail="Corrupt or invalid audio file. Please check your file.")

        duration = audio_utils.duration_seconds(y, sr)
        
        # Duration Check (Member 1 Requirement: "Errors are shown for too-short audio")
        if duration < 1.0:
             raise HTTPException(status_code=400, detail=f"Audio is too short ({duration}s). Please provide at least 1 second of speech.")

        # Save as normalized WAV
        final_path = UPLOAD_DIR / f"{file_id}.wav"
        audio_utils.save_wav(final_path, y, sr)
        
        return {
            "file_id": file_id,
            "filename": file.filename,
            "duration": duration,
            "sample_rate": sr
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process audio: {str(e)}")
    finally:
        if temp_path.exists():
            temp_path.unlink()


@router.get("/file/{file_id}")
async def get_audio_file(file_id: str):
    """
    Serve the audio file for browser playback.
    """
    path = UPLOAD_DIR / f"{file_id}.wav"
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    with open(path, "rb") as f:
        content = f.read()
    
    return Response(content=content, media_type="audio/wav")


@router.get("/spectrogram")
async def get_spectrogram(file_id: str, show_peaks: bool = True, overlay_mode: str = "fingerprint"):
    """
    Generate a Mel-spectrogram image and return it as base64.
    overlay_mode: 'plain' | 'fingerprint' | 'mfcc'
    """
    path = UPLOAD_DIR / f"{file_id}.wav"
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        y, sr = audio_utils.load_audio(path)
        duration = len(y) / sr
        
        # Compute Mel spectrogram
        S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=8000)
        S_dB = librosa.power_to_db(S, ref=np.max)

        # Get fingerprint peaks (100 for high-density interactivity)
        peaks = find_spectrogram_peaks(y, sr, top_n=100)

        # Create plot with dark theme
        plt.style.use('dark_background')
        fig, ax = plt.subplots(figsize=(12, 5), facecolor='#0f172a')
        
        # 1. Main Spectrogram
        img = librosa.display.specshow(
            S_dB, sr=sr, x_axis='time', y_axis='mel', fmax=8000, 
            cmap='magma', ax=ax, alpha=0.9
        )

        # 2. Overlay handling
        # Fingerprint peaks are now handled exclusively by the frontend for 100% interactivity.
        # Baking dots into the image (static pixels) makes them non-responsive to mouse events.

        # Curves are now handled by the frontend for dynamic opacity
        mfcc_curve = []
        centroid_curve = []

        if overlay_mode == "mfcc":
            from services.feature_extractor import extract_frame_features
            frame_data = extract_frame_features(y, sr)
            times_arr = np.array(frame_data["times"])
            mels_scale = librosa.mel_frequencies(n_mels=128, fmax=8000)
            max_mel = mels_scale[-1]

            # Normalize for frontend percentage positioning
            mfcc0 = np.array(frame_data["mfcc_0"])
            mfcc0_norm = (mfcc0 - mfcc0.min()) / ((mfcc0.max() - mfcc0.min()) + 1e-6)
            
            centroid = np.array(frame_data["centroid"])
            centroid_norm = centroid / max_mel

            mfcc_curve = [
                {"t": float(t / duration), "v": float(v)} 
                for t, v in zip(times_arr, mfcc0_norm)
            ]
            centroid_curve = [
                {"t": float(t / duration), "v": float(v)} 
                for t, v in zip(times_arr, centroid_norm)
            ]

        # 3. Colorbar (dB scale)
        cbar = fig.colorbar(img, format='%+2.0f dB', ax=ax)
        cbar.ax.tick_params(labelsize=8, color='#94a3b8')
        cbar.set_label('Intensity (dB)', color='#94a3b8', fontsize=9)
        cbar.outline.set_edgecolor('#334155')
        
        mode_label = {"plain": "Plain Mel Spectrogram", "fingerprint": "Acoustic Fingerprint", "mfcc": "MFCC Projection"}.get(overlay_mode, "Spectrogram")
        ax.set_title(f"{mode_label} — {file_id[:8]}…", color='#f8fafc', fontsize=13, pad=16)
        ax.set_xlabel("Time (s)", color='#94a3b8', fontsize=10)
        ax.set_ylabel("Frequency (Hz)", color='#94a3b8', fontsize=10)
        ax.tick_params(colors='#64748b', labelsize=8)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#334155')
        ax.spines['bottom'].set_color('#334155')

        plt.tight_layout()
        pos = ax.get_position()
        bbox = [pos.x0, pos.y0, pos.width, pos.height]

        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=120, facecolor=fig.get_facecolor())
        plt.close(fig)
        buf.seek(0)
        img_b64 = base64.b64encode(buf.read()).decode()

        # Build overlay_points for frontend tooltips
        mels = librosa.mel_frequencies(n_mels=128, fmax=8000)
        overlay_points = [
            {
                "time": float(p['time_pct'] * duration),
                "frequency": float(mels[int(p['freq_pct'] * 127)]),
                "strength": p['strength'],
                "time_pct": p['time_pct'],
                "freq_pct": p['freq_pct']
            }
            for p in peaks
        ]

        return {
            "image_b64": img_b64,
            "duration": duration,
            "overlay_points": overlay_points,
            "mfcc_curve": mfcc_curve,
            "centroid_curve": centroid_curve,
            "bbox": bbox
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate spectrogram: {str(e)}")


@router.get("/feature-evolution")
async def get_feature_evolution(file_id: str):
    """
    Generate a plot showing time-series features (MFCC, Centroid, RMS).
    """
    path = UPLOAD_DIR / f"{file_id}.wav"
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        from services.feature_extractor import extract_frame_features
        y, sr = audio_utils.load_audio(path)
        data = extract_frame_features(y, sr)
        
        times = data["times"]
        
        plt.style.use('dark_background')
        fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(12, 8), sharex=True, facecolor='#0f172a')
        
        # 1. MFCC0 (Energy/Timbre)
        ax1.plot(times, data["mfcc_0"], color='#8b5cf6', linewidth=1.5)
        ax1.set_ylabel("MFCC 0", color='#94a3b8')
        ax1.fill_between(times, data["mfcc_0"], color='#8b5cf6', alpha=0.1)
        
        # 2. Spectral Centroid (Brightness)
        ax2.plot(times, data["centroid"], color='#38bdf8', linewidth=1.5)
        ax2.set_ylabel("Centroid", color='#94a3b8')
        ax2.fill_between(times, data["centroid"], color='#38bdf8', alpha=0.1)
        
        # 3. RMS Energy (Loudness)
        ax3.plot(times, data["rms"], color='#fbbf24', linewidth=1.5)
        ax3.set_ylabel("RMS", color='#94a3b8')
        ax3.fill_between(times, data["rms"], color='#fbbf24', alpha=0.1)
        ax3.set_xlabel("Time (s)", color='#94a3b8')
        
        for ax in [ax1, ax2, ax3]:
            ax.set_facecolor('none')
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_color('#334155')
            ax.spines['bottom'].set_color('#334155')
            ax.grid(True, alpha=0.05)

        fig.suptitle(f"Spectral Dynamics - {file_id}", color='#f8fafc', fontsize=14)
        plt.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=100, facecolor=fig.get_facecolor())
        plt.close(fig)
        buf.seek(0)
        img_b64 = base64.b64encode(buf.read()).decode()

        return {"image_b64": img_b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate evolution: {str(e)}")


@router.post("/mix")
async def mix_audio(req: MixRequest):
    """
    Task 5: Weighted average of two files.
    mixed = (1 - weight) * file_a + weight * file_b
    """
    path_a = UPLOAD_DIR / f"{req.file_id_a}.wav"
    path_b = UPLOAD_DIR / f"{req.file_id_b}.wav"

    if not path_a.exists() or not path_b.exists():
        raise HTTPException(status_code=404, detail="One or both source files not found")

    try:
        y_a, sr_a = audio_utils.load_audio(path_a)
        y_b, sr_b = audio_utils.load_audio(path_b)

        # Ensure same sample rate (audio_utils.load_audio should handle this)
        # Pad shorter signal with zeros to match longer one
        max_len = max(len(y_a), len(y_b))
        y_a_pad = np.pad(y_a, (0, max_len - len(y_a)))
        y_b_pad = np.pad(y_b, (0, max_len - len(y_b)))

        # Weighted summation
        y_mixed = (1.0 - req.weight) * y_a_pad + req.weight * y_b_pad
        
        # Normalize to prevent clipping
        y_mixed = audio_utils.normalize_audio(y_mixed)

        mixed_id = f"mixed_{uuid.uuid4()}"
        audio_utils.save_wav(UPLOAD_DIR / f"{mixed_id}.wav", y_mixed, sr_a)

        return {
            "file_id": mixed_id,
            "duration": audio_utils.duration_seconds(y_mixed, sr_a),
            "contribution_a": 1.0 - req.weight,
            "contribution_b": req.weight
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mix audio: {str(e)}")