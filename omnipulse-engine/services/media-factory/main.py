#!/usr/bin/env python3
"""
OmniPulse Media Factory Service Entrypoint.
Orchestrates TTS generation, thumbnail design, FFmpeg video assembly, and Whisper subtitle extraction.
"""
import sys
from pathlib import Path

src_dir = Path(__file__).resolve().parent / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from main import main

if __name__ == "__main__":
    main()
