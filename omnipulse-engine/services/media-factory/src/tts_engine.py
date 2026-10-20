import os
import asyncio
import logging
from typing import Optional
import edge_tts

logger = logging.getLogger("media_factory.tts")

BRAND_VOICES = {
    "talentxcel": "en-IN-NeerjaNeural",
    "chatr": "en-IN-PrabhatNeural",
    "nutytales": "en-IN-NeerjaNeural",
}

DEFAULT_VOICE = "en-IN-NeerjaNeural"

def _generate_fallback_tts(script: str, output_path: str):
    """Fallback audio generator using gTTS or synthetic silence if edge-tts is restricted."""
    try:
        from gtts import gTTS
        logger.info(f"Generating fallback voiceover via gTTS (co.in) -> {output_path}")
        tts = gTTS(text=script.strip(), lang="en", tld="co.in")
        tts.save(output_path)
        return os.path.abspath(output_path)
    except Exception as gtts_err:
        logger.warning(f"gTTS fallback unavailable ({gtts_err}). Generating synthetic tone via FFmpeg.")
        # Minimal synthetic audio file via FFmpeg
        import subprocess
        subprocess.run(
            ["ffmpeg", "-y", "-f", "lavfi", "-i", "anoisesrc=d=15:c=pink:r=24000:a=0.01", "-c:a", "libmp3lame", output_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        return os.path.abspath(output_path)

async def generate_tts(
    script: str,
    output_path: str,
    voice: str = "en-IN-NeerjaNeural",
    rate: str = "+0%",
    volume: str = "+0%",
) -> str:
    """
    Generate TTS audio file from script text. Returns path to output MP3.
    Uses edge-tts as primary engine with automatic resilient fallback.
    """
    if not script or not script.strip():
        raise ValueError("Script text cannot be empty for TTS generation.")

    # Ensure parent directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    logger.info(f"Generating TTS audio using voice '{voice}' -> {output_path}")

    try:
        communicate = edge_tts.Communicate(script.strip(), voice, rate=rate, volume=volume)
        await communicate.save(output_path)
        logger.info(f"TTS generated successfully: {output_path} (size: {os.path.getsize(output_path)} bytes)")
        return os.path.abspath(output_path)
    except Exception as err:
        logger.warning(f"Edge-TTS failed ({err}). Engaging resilient fallback TTS pipeline.")
        return _generate_fallback_tts(script, output_path)

def generate_tts_sync(
    script: str,
    output_path: str,
    voice: Optional[str] = None,
    brand: Optional[str] = None,
) -> str:
    """
    Synchronous helper wrapper around generate_tts for pipeline execution.
    Automatically resolves brand voice if specified.
    """
    selected_voice = voice or (BRAND_VOICES.get(brand, DEFAULT_VOICE) if brand else DEFAULT_VOICE)

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(
                    asyncio.run, generate_tts(script, output_path, selected_voice)
                ).result()
        else:
            return loop.run_until_complete(generate_tts(script, output_path, selected_voice))
    except RuntimeError:
        return asyncio.run(generate_tts(script, output_path, selected_voice))
