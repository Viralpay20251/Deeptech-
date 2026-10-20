import os
import sys
import time
import signal
import logging
from pathlib import Path
from dotenv import load_dotenv

# Ensure local imports work correctly
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from queue_worker import QueueWorker

# Load environment
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("media_factory.main")

running = True

def handle_shutdown(signum, frame):
    global running
    logger.info(f"Received termination signal ({signum}). Gracefully stopping Media Factory worker...")
    running = False

signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)

def main():
    logger.info("Starting OmniPulse Media Factory Service (Autonomous Growth OS)...")
    poll_interval_seconds = int(os.getenv("MEDIA_POLL_INTERVAL_SECONDS", "30"))

    worker = QueueWorker()

    while running:
        try:
            logger.info("Polling for pending content items...")
            processed = worker.run_cycle(max_items=5)
            if processed > 0:
                logger.info(f"Processed {processed} media items this cycle.")
            else:
                logger.debug("No pending content found in queue.")
        except Exception as exc:
            logger.error(f"Error in media worker cycle: {exc}", exc_info=True)

        # Sleep for poll interval in 1s increments for fast shutdown response
        for _ in range(poll_interval_seconds):
            if not running:
                break
            time.sleep(1)

    logger.info("OmniPulse Media Factory Service exited.")

if __name__ == "__main__":
    main()
