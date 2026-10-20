import os
import sys
import time
import signal
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
import schedule
from dotenv import load_dotenv

# Ensure local imports work regardless of working directory
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from searxng_client import SearXNGClient, BRAND_SEED_QUERIES
from ollama_analyzer import OllamaAnalyzer
from trend_persister import TrendPersister

# Load environment variables
load_dotenv()

# Configure logging with timestamps and log levels
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("trend_brain.main")

running = True

def handle_shutdown(signum, frame):
    global running
    logger.info(f"Received termination signal ({signum}). Gracefully shutting down Trend Brain...")
    running = False

signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)

async def run_discovery_cycle(
    searxng: SearXNGClient,
    analyzer: OllamaAnalyzer,
    persister: TrendPersister,
):
    """
    Executes one complete discovery cycle across all brand clusters.
    1. Search trending seed queries on SearXNG.
    2. Generate viral angles & hook lines via local Ollama.
    3. Calculate opportunity score and upsert to Supabase trend_signals.
    4. Push top 3 opportunities to Redis queue.
    """
    logger.info("=== Starting OmniPulse Trend Brain Discovery Cycle ===")
    cycle_start = time.time()
    brands = list(BRAND_SEED_QUERIES.keys())

    total_discovered = 0
    total_qualified = 0

    for brand in brands:
        logger.info(f"Processing trend cluster for brand: [{brand}]")
        brand_opportunities = []

        try:
            brand_trends = await searxng.get_brand_trends(brand)
            logger.info(f"Brand '{brand}': Retrieved {len(brand_trends)} trending query responses.")

            for trend in brand_trends:
                query = trend.get("query", "")
                if not query:
                    continue

                total_discovered += 1
                search_volume = trend.get("search_volume_estimate", 5000)
                competition = trend.get("competition_score", 0.5)
                raw_results = trend.get("results", [])

                try:
                    # Generate angle, hooks and format via Ollama
                    analysis = await analyzer.analyze_trend(query, brand)

                    # Persist if opportunity_score > 0.3
                    persisted = persister.persist_trend_opportunity(
                        brand=brand,
                        query=query,
                        search_volume=search_volume,
                        competition=competition,
                        angle_data=analysis,
                        raw_results=raw_results,
                    )

                    if persisted:
                        brand_opportunities.append(persisted)
                        total_qualified += 1

                except Exception as query_err:
                    logger.error(f"Error analyzing query '{query}' for brand '{brand}': {query_err}")
                    continue

            # Publish top 3 opportunities for this brand cluster to Redis
            persister.publish_top_opportunities(brand, brand_opportunities)

        except Exception as brand_err:
            logger.error(f"Error during discovery cycle for brand '{brand}': {brand_err}")
            continue

    elapsed = time.time() - cycle_start
    logger.info(
        f"=== Trend Brain Discovery Completed in {elapsed:.2f}s | "
        f"Total Queries: {total_discovered} | Stored Opportunities (>0.3): {total_qualified} ==="
    )

def execute_discovery_job():
    """Synchronous job wrapper executed by schedule."""
    logger.info("Scheduled trigger fired: Running trend discovery job...")
    searxng = SearXNGClient()
    analyzer = OllamaAnalyzer()
    persister = TrendPersister()

    try:
        asyncio.run(run_discovery_cycle(searxng, analyzer, persister))
    except Exception as exc:
        logger.error(f"Unhandled error in discovery cycle job: {exc}", exc_info=True)

def main():
    logger.info("Initializing OmniPulse Trend Brain Service (Autonomous Growth OS)...")
    logger.info(f"Target brands: {list(BRAND_SEED_QUERIES.keys())}")

    # Run immediate first cycle on startup
    execute_discovery_job()

    # Schedule recurring cycle every 2 hours
    schedule.every(2).hours.do(execute_discovery_job)
    logger.info("Scheduled trend discovery loop every 2 hours.")

    while running:
        schedule.run_pending()
        time.sleep(5)

    logger.info("OmniPulse Trend Brain Service stopped.")

if __name__ == "__main__":
    main()
