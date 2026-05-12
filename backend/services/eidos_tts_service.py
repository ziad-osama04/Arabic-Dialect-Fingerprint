"""
TTS Service — Arabic Text-to-Speech via eidosSpeech API
=========================================================
Uses eidosspeech.xyz API for Microsoft Edge Neural TTS voices.
Supports pitch (frequency) adjustments to match original tones.

Arabic voices mapped:
  EGY (Egypt): ar-EG-SalmaNeural (F), ar-EG-ShakirNeural (M)
  MAG (Morocco): ar-MA-MounaNeural (F), ar-MA-JamalNeural (M)
  LEV (Lebanon): ar-LB-LaylaNeural (F), ar-LB-RamiNeural (M)
  GLF (UAE): ar-AE-FatimaNeural (F), ar-AE-HamdanNeural (M)
"""

import requests
import logging

logger = logging.getLogger(__name__)

EIDOS_API_URL = "https://eidosspeech.xyz/api/v1/tts"

# Using anonymous tier (No Auth required for web origin, but we are calling from backend)
# If rate limits are hit, an API key can be added to headers: "X-API-Key": "your_key"

DIALECT_VOICE_MAP = {
    # Egypt
    ("EGY", "F"): "ar-EG-SalmaNeural",
    ("EGY", "M"): "ar-EG-ShakirNeural",
    # Maghreb (Morocco/Algeria/Tunisia)
    ("MAG", "F"): "ar-MA-MounaNeural",
    ("MAG", "M"): "ar-MA-JamalNeural",
    ("DZL", "F"): "ar-DZ-AminaNeural",
    ("DZL", "M"): "ar-DZ-IsmaelNeural",
    ("TUN", "F"): "ar-TN-ReemNeural",
    ("TUN", "M"): "ar-TN-HediNeural",
    # Levantine (Lebanon/Syria/Jordan/Palestine)
    ("LEV", "F"): "ar-LB-LaylaNeural",
    ("LEV", "M"): "ar-LB-RamiNeural",
    ("SYR", "F"): "ar-SY-AmanyNeural",
    ("SYR", "M"): "ar-SY-LaithNeural",
    ("JOR", "F"): "ar-JO-SanaNeural",
    ("JOR", "M"): "ar-JO-TamerNeural",
    # Gulf (UAE/Saudi/Kuwait/Qatar)
    ("GLF", "F"): "ar-AE-FatimaNeural",
    ("GLF", "M"): "ar-AE-HamdanNeural",
    ("SAU", "F"): "ar-SA-ZariyahNeural",
    ("SAU", "M"): "ar-SA-HamedNeural",
    ("KWT", "F"): "ar-KW-NouraNeural",
    ("KWT", "M"): "ar-KW-FahedNeural",
    ("QAT", "F"): "ar-QA-AmalNeural",
    ("QAT", "M"): "ar-QA-MoazNeural",
    # Iraq
    ("IRQ", "F"): "ar-IQ-RanaNeural",
    ("IRQ", "M"): "ar-IQ-BasselNeural",
    # Standard / Default
    ("MSA", "F"): "ar-SA-ZariyahNeural",
    ("MSA", "M"): "ar-SA-HamedNeural",
}

def get_voice_info(dialect: str, gender: str = "F") -> dict:
    """Return voice info for a dialect and gender."""
    # Try exact match, then try MSA fallback
    voice = DIALECT_VOICE_MAP.get((dialect, gender))
    if not voice:
        voice = DIALECT_VOICE_MAP.get(("MSA", gender), "ar-SA-ZariyahNeural")
        
    return {
        "available": True,
        "voice": voice,
        "note": f"eidosSpeech Neural TTS: {voice}"
    }

def synthesize_to_wav_bytes(text: str, dialect: str = "MSA", gender: str = "F", pitch: str = "+0Hz") -> bytes:
    """
    Synthesize Arabic text to speech using eidosSpeech.xyz API.
    pitch: string format like '+5Hz' or '-10Hz' to match original frequency/tone.
    Returns MP3 bytes.
    """
    if not text or not text.strip():
        raise RuntimeError("Text cannot be empty.")

    # Try exact match, then try MSA fallback
    voice = DIALECT_VOICE_MAP.get((dialect, gender))
    if not voice:
        voice = DIALECT_VOICE_MAP.get(("MSA", gender), "ar-SA-ZariyahNeural")

    logger.info(f"eidosSpeech: Synthesizing dialect={dialect} gender={gender} pitch={pitch} voice={voice}")

    payload = {
        "text": text,
        "voice": voice,
        "format": "mp3",
        "rate": "+0%",
        "pitch": pitch
    }

    headers = {
        "Content-Type": "application/json",
        "X-API-Key": "esk_zJCyGLo0cJMOebRsQRfx7yTWfGA33Cc5" # Add if using registered tier
    }

    try:
        response = requests.post(EIDOS_API_URL, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            audio_bytes = response.content
            logger.info(f"eidosSpeech: Generated {len(audio_bytes)} bytes of MP3 audio.")
            
            # Log rate limit info if available
            remaining = response.headers.get('X-RateLimit-Remaining-Day')
            if remaining:
                logger.info(f"eidosSpeech: Daily requests remaining: {remaining}")
                
            return audio_bytes
        else:
            error_msg = f"HTTP {response.status_code}"
            try:
                err_data = response.json()
                error_msg += f" - {err_data.get('message', err_data)}"
            except Exception:
                error_msg += f" - {response.text[:100]}"
            raise RuntimeError(f"eidosSpeech API failed: {error_msg}")
            
    except requests.exceptions.RequestException as e:
        logger.error(f"eidosSpeech connection error: {e}")
        raise RuntimeError(f"Failed to connect to TTS service: {e}")

def is_available() -> bool:
    """Check if requests library is available."""
    return True
