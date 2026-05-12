"""
TTS Service — Arabic Text-to-Speech via edge-tts
==================================================
Uses Microsoft Edge's Neural TTS engine (via the edge-tts library)
for high-quality, free Arabic speech synthesis.

No API key. No account. Uses the same engine as Microsoft Edge Read Aloud.

Arabic voices available:
  ar-EG-SalmaNeural     — Egyptian Arabic, Female
  ar-EG-ShakirNeural    — Egyptian Arabic, Male
  ar-SA-ZariyahNeural   — Saudi/MSA Arabic, Female
  ar-SA-HamedNeural     — Saudi/MSA Arabic, Male
  ar-SY-AmanyNeural     — Syrian/Levantine, Female
  ar-SY-LaithNeural     — Syrian/Levantine, Male
  ar-MA-MounaNeural     — Moroccan/Maghrebi, Female
  ar-MA-JamalNeural     — Moroccan/Maghrebi, Male
"""

import asyncio
import io
import logging
import edge_tts

logger = logging.getLogger(__name__)

# Map (dialect, gender) to Microsoft Edge Neural Arabic voices
DIALECT_VOICE_MAP = {
    # Egypt
    ("EGY", "F"): "ar-EG-SalmaNeural",
    ("EGY", "M"): "ar-EG-ShakirNeural",
    # Maghreb
    ("MAG", "F"): "ar-MA-MounaNeural",
    ("MAG", "M"): "ar-MA-JamalNeural",
    ("DZL", "F"): "ar-DZ-AminaNeural",
    ("DZL", "M"): "ar-DZ-IsmaelNeural",
    # Levantine
    ("LEV", "F"): "ar-SY-AmanyNeural",
    ("LEV", "M"): "ar-SY-LaithNeural",
    ("JOR", "F"): "ar-JO-SanaNeural",
    ("JOR", "M"): "ar-JO-TamerNeural",
    # Gulf
    ("GLF", "F"): "ar-SA-ZariyahNeural",
    ("GLF", "M"): "ar-SA-HamedNeural",
    ("KWT", "F"): "ar-KW-NouraNeural",
    ("KWT", "M"): "ar-KW-FahedNeural",
    # Iraq
    ("IRQ", "F"): "ar-IQ-RanaNeural",
    ("IRQ", "M"): "ar-IQ-BasselNeural",
    # Standard
    ("MSA", "F"): "ar-SA-ZariyahNeural",
    ("MSA", "M"): "ar-SA-HamedNeural",
}


def get_voice_info(dialect: str, gender: str = "F") -> dict:
    """Return voice info for a dialect and gender."""
    voice = DIALECT_VOICE_MAP.get((dialect, gender))
    if not voice:
        voice = DIALECT_VOICE_MAP.get(("MSA", gender), "ar-SA-ZariyahNeural")
        
    return {
        "available": True,
        "voice": voice,
        "note": f"Microsoft Edge Neural TTS: {voice}"
    }


async def _synthesize_async(text: str, voice: str) -> bytes:
    """Async helper to generate speech and return MP3 bytes."""
    communicate = edge_tts.Communicate(text, voice, rate="-5%")
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    buf.seek(0)
    return buf.read()


def synthesize_to_wav_bytes(text: str, dialect: str = "MSA", gender: str = "F") -> bytes:
    """
    Synthesize Arabic text to speech using Microsoft Edge Neural TTS.
    Returns MP3 bytes (edge-tts always outputs MP3).
    """
    if not text or not text.strip():
        raise RuntimeError("Text cannot be empty.")

    voice = DIALECT_VOICE_MAP.get((dialect, gender))
    if not voice:
        voice = DIALECT_VOICE_MAP.get(("MSA", gender), "ar-SA-ZariyahNeural")

    logger.info(f"edge-tts: Synthesizing dialect={dialect} gender={gender} voice={voice}: '{text[:60]}...'")
    try:
        # Run the async function in a new event loop (safe for FastAPI threads)
        audio_bytes = asyncio.run(_synthesize_async(text, voice))
    except RuntimeError:
        # If we're already inside an event loop (rare), use a thread executor
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, _synthesize_async(text, voice))
            audio_bytes = future.result()

    if not audio_bytes:
        raise RuntimeError("edge-tts returned empty audio.")

    logger.info(f"edge-tts: Generated {len(audio_bytes)} bytes of MP3 audio.")
    return audio_bytes


def is_available() -> bool:
    """Check if edge-tts is installed and accessible."""
    try:
        import edge_tts  # noqa
        return True
    except ImportError:
        return False
