import os
import shutil
import logging
import subprocess
from typing import Optional

logger = logging.getLogger("media_factory.video_assembler")

def find_ffmpeg_executable() -> str:
    """Locates the ffmpeg executable on system PATH or standard directories."""
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path:
        return ffmpeg_path

    # Check common fallback locations
    candidates = [
        "/usr/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c

    return "ffmpeg"

def assemble_video(
    thumbnail_path: str,
    audio_path: str,
    output_path: str,
    hook_text: Optional[str] = None,
    max_duration_seconds: int = 60,
    enable_drawtext: bool = False,
) -> str:
    """
    Assembles a 60-second 1080x1920 vertical video from thumbnail JPEG and TTS audio MP3 using FFmpeg:
    1. Loops thumbnail image to match audio duration (capped at 60s).
    2. Encodes with libx264 (tune stillimage), 128k AAC audio, yuv420p pixel format.
    3. Optionally applies drawtext filter overlay.
    4. Ensures file size is well under 50MB.
    Returns absolute path to output MP4.
    """
    if not os.path.exists(thumbnail_path):
        raise FileNotFoundError(f"Thumbnail not found at: {thumbnail_path}")
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found at: {audio_path}")

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    ffmpeg_bin = find_ffmpeg_executable()
    logger.info(f"Assembling video using FFmpeg ({ffmpeg_bin}) -> {output_path}")

    # Build FFmpeg command arguments
    # Base command: ffmpeg -y -loop 1 -i thumbnail.jpg -i audio.mp3 -c:v libx264 -tune stillimage -c:a aac -b:a 128k -pix_fmt yuv420p -t 60 -shortest output.mp4
    cmd = [
        ffmpeg_bin,
        "-y",                   # Overwrite output
        "-loop", "1",
        "-i", os.path.abspath(thumbnail_path),
        "-i", os.path.abspath(audio_path),
    ]

    # Video filters
    video_filters = []

    # Optional drawtext filter overlay
    if enable_drawtext and hook_text:
        # Sanitize text for drawtext filter
        clean_text = hook_text.replace("'", "").replace(":", " -")[:60]
        # Box overlay with white text
        drawtext_filter = (
            f"drawtext=text='{clean_text}':"
            f"fontsize=54:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=15:"
            f"x=(w-text_w)/2:y=(h-text_h)/2"
        )
        video_filters.append(drawtext_filter)

    if video_filters:
        cmd.extend(["-vf", ",".join(video_filters)])

    cmd.extend([
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        "-t", str(max_duration_seconds),
        "-shortest",
        os.path.abspath(output_path),
    ])

    logger.debug(f"Running FFmpeg command: {' '.join(cmd)}")

    try:
        process = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        logger.warning(f"FFmpeg command failed with filters ({exc}). Falling back to clean stillimage command.")
        # Fallback to standard command without filters
        fallback_cmd = [
            ffmpeg_bin,
            "-y",
            "-loop", "1",
            "-i", os.path.abspath(thumbnail_path),
            "-i", os.path.abspath(audio_path),
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-c:a", "aac",
            "-b:a", "128k",
            "-pix_fmt", "yuv420p",
            "-t", str(max_duration_seconds),
            "-shortest",
            os.path.abspath(output_path),
        ]
        fallback_proc = subprocess.run(
            fallback_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True,
        )

    if not os.path.exists(output_path):
        raise RuntimeError(f"FFmpeg completed without creating output file at: {output_path}")

    file_size_bytes = os.path.getsize(output_path)
    file_size_mb = file_size_bytes / (1024 * 1024)
    logger.info(f"Video assembled successfully: {output_path} ({file_size_mb:.2f} MB)")

    if file_size_mb > 50.0:
        logger.warning(f"Warning: Output file exceeds 50MB ({file_size_mb:.2f} MB)")

    return os.path.abspath(output_path)
