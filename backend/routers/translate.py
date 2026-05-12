"""
Translate router — dialect text conversion and TTS endpoints.
Owner: Member 4
"""

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from typing import Optional

from services.llm_service import (
    translate_dialect,
    check_llm_status,
    DIALECT_NAMES,
)
from services.tts_service import (
    synthesize_to_wav_bytes as edge_synthesize,
    get_voice_info as edge_get_voice_info,
    is_available as edge_available,
)
from services.eidos_tts_service import (
    synthesize_to_wav_bytes as eidos_synthesize,
    get_voice_info as eidos_get_voice_info,
    is_available as eidos_available,
)


router = APIRouter()


# ── Request/Response schemas ────────────────────────────────────────────

class TranslateTextRequest(BaseModel):
    text: str
    src_dialect: str  # e.g. "EGY"
    tgt_dialect: str  # e.g. "JOR"


class TranslateTextResponse(BaseModel):
    translated_text: str
    src_dialect: str
    tgt_dialect: str


class SynthesizeRequest(BaseModel):
    text: str
    dialect: str  # e.g. "MSA"
    gender: str = "F"  # "M" or "F"
    pitch: str = "+0Hz"  # Optional frequency adjustment
    provider: str = "eidos"  # "eidos" or "edge"
    reference_file_id: Optional[str] = None


# ── Endpoints ───────────────────────────────────────────────────────────

@router.get("/health")
def translate_health():
    """Health check for the translation/TTS services."""
    lm_ok = check_llm_status()
    return {
        "status": "ok",
        "owner": "member4",
        "llm_available": lm_ok,
        "edge_tts_available": edge_available(),
        "eidos_tts_available": eidos_available(),
        "supported_dialects": list(DIALECT_NAMES.keys()),
        "endpoints": [
            "POST /translate/text",
            "POST /translate/synthesize",
        ],
    }


@router.post("/text", response_model=TranslateTextResponse)
async def translate_text(req: TranslateTextRequest):
    """
    Convert Arabic text from one dialect to another using the local LLM.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(400, "Text cannot be empty.")

    if req.src_dialect not in DIALECT_NAMES:
        raise HTTPException(400, f"Unknown source dialect '{req.src_dialect}'.")
    if req.tgt_dialect not in DIALECT_NAMES:
        raise HTTPException(400, f"Unknown target dialect '{req.tgt_dialect}'.")

    try:
        translated = translate_dialect(req.text, req.src_dialect, req.tgt_dialect)
        return TranslateTextResponse(
            translated_text=translated,
            src_dialect=req.src_dialect,
            tgt_dialect=req.tgt_dialect,
        )
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except RuntimeError as e:
        raise HTTPException(500, f"Translation failed: {str(e)}")


@router.post("/synthesize")
async def synthesize_speech(req: SynthesizeRequest):
    """
    Synthesize Arabic text to speech using either edge-tts or eidosSpeech.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(400, "Text cannot be empty.")

    try:
        # Strip inputs for robust matching
        d_code = req.dialect.strip().upper()
        g_code = req.gender.strip().upper()
        
        if req.provider == "edge":
            audio_bytes = edge_synthesize(req.text, d_code, g_code)
        else:
            audio_bytes = eidos_synthesize(req.text, d_code, g_code, req.pitch)

        # Apply Automatic Pitch and Tone Matching if a reference file is provided
        if req.reference_file_id:
            try:
                from services.pitch_service import apply_tone_filter, estimate_pitch
                from services.audio_utils import load_audio, UPLOAD_DIR
                import librosa
                import numpy as np
                import io
                import soundfile as sf

                # 1. Analyze reference audio
                wav_path = UPLOAD_DIR / f"{req.reference_file_id}.wav"
                if not wav_path.exists():
                    print(f"Reference file not found: {wav_path}")
                    raise FileNotFoundError(f"Reference file {req.reference_file_id} not found.")

                y_ref, sr_ref = load_audio(wav_path)
                ref_info = estimate_pitch(y_ref, sr_ref)
                
                if ref_info["detected"]:
                    # 2. Analyze generated audio
                    y_gen, sr_gen = librosa.load(io.BytesIO(audio_bytes), sr=None)
                    gen_info = estimate_pitch(y_gen, sr_gen)
                    
                    if gen_info["detected"]:
                        # 3. Calculate pitch shift (semitones)
                        # n_semitones = 12 * log2(f2 / f1)
                        f_ref = ref_info["median_pitch"]
                        f_gen = gen_info["median_pitch"]
                        n_semitones = 12 * np.log2(f_ref / f_gen)
                        
                        # Clamp shift to prevent extreme distortion
                        n_semitones = max(-5, min(5, n_semitones))
                        
                        if abs(n_semitones) > 0.5:
                            print(f"Auto-Pitch: Shifting {n_semitones:.2f} semitones to match {f_ref}Hz")
                            y_gen = librosa.effects.pitch_shift(y_gen, sr=sr_gen, n_steps=n_semitones)
                        
                        # 4. Apply Tone Filter (Spectral Centroid)
                        ref_centroid = ref_info.get("spectral_centroid", 0)
                        if ref_centroid > 0:
                            # Re-export to bytes for the filter (filter expects bytes)
                            buf = io.BytesIO()
                            sf.write(buf, y_gen, sr_gen, format='WAV')
                            audio_bytes = apply_tone_filter(buf.getvalue(), ref_centroid)
                        else:
                            # Just export the pitch-shifted audio
                            buf = io.BytesIO()
                            sf.write(buf, y_gen, sr_gen, format='WAV')
                            audio_bytes = buf.getvalue()
            except Exception as e:
                print(f"Automatic voice matching failed: {e}")
            
        return Response(
            content=audio_bytes,
            media_type="audio/wav" if req.reference_file_id else "audio/mpeg",
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@router.get("/voice-info")
def voice_info(dialect: str = "MSA", provider: str = "eidos"):
    """Check TTS voice availability for a given dialect."""
    if provider == "edge":
        info = edge_get_voice_info(dialect)
    else:
        info = eidos_get_voice_info(dialect)
        
    return {
        "dialect": dialect,
        "provider": provider,
        **info,
    }
