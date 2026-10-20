import os
import sys
import time
import signal
import logging
from datetime import datetime, timezone, timedelta, date
from pathlib import Path
import schedule
from dotenv import load_dotenv

# Ensure local imports work correctly
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from gsc_client import GSCClient
from indexing_api import GoogleIndexingAPIClient
from indexnow_client import IndexNowClient
from telemetry_recorder import TelemetryRecorder
from sitemap_submitter import SitemapSubmitter, FALLBACK_AUTHORITATIVE_HOSTNAMES

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("gsc_indexer.main")

running = True

def handle_shutdown(signum, frame):
    global running
    logger.info(f"Received signal {signum}. Stopping GSC Indexer Service...")
    running = False

signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)

class GSCIndexerOrchestrator:
    """
    Coordinates Google Search Console telemetry harvesting, Google Indexing API quotas,
    real-time IndexNow batch notifications, and weekly sitemap indexing sweeps.
    """

    def __init__(self):
        self.gsc_client = GSCClient()
        self.indexing_client = GoogleIndexingAPIClient()
        self.indexnow_client = IndexNowClient()
        self.telemetry = TelemetryRecorder()
        self.sitemap_submitter = SitemapSubmitter(gsc_client=self.gsc_client)
        self.supabase = self.telemetry.supabase

    def run_telemetry_collection(self):
        """
        Scheduled daily at 6 AM IST (00:30 UTC).
        Harvests search analytics (clicks, impressions, CTR, position) and index coverage
        for all registered domains and records metrics in Supabase gsc_telemetry.
        """
        logger.info("=== Starting Daily GSC Telemetry Collection (00:30 UTC / 06:00 IST) ===")
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        three_days_ago = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%d")

        domains = self.sitemap_submitter.fetch_allowed_hostnames()
        for d in domains:
            hostname = d.get("hostname", "")
            prop_uri = d.get("search_console_property_uri") or f"sc-domain:{hostname}"
            if not hostname:
                continue

            try:
                # 1. Fetch search analytics
                analytics_rows = self.gsc_client.get_search_analytics(
                    site_url=prop_uri,
                    start_date=three_days_ago,
                    end_date=yesterday,
                )

                # 2. Fetch coverage summary
                coverage = self.gsc_client.get_index_coverage(site_url=prop_uri)

                # 3. Persist to gsc_telemetry
                self.telemetry.record_daily_metrics(
                    hostname=hostname,
                    analytics_rows=analytics_rows,
                    coverage_data=coverage,
                    metric_date=yesterday,
                )

            except Exception as err:
                logger.error(f"Error processing telemetry for {hostname}: {err}")

        logger.info("=== Daily GSC Telemetry Collection Finished ===")

    def run_indexing_api_batch(self):
        """
        Scheduled daily at 9 AM IST (03:30 UTC).
        Submits top priority URLs from pseo_bot_wave_queue to Google Indexing API
        enforcing the 200 URL/day limit.
        """
        logger.info("=== Starting Daily Google Indexing API Batch (03:30 UTC / 09:00 IST) ===")
        today_str = date.today().isoformat()
        quota_used = self.telemetry.get_quota_used_today(target_date=today_str)

        candidate_urls: List[str] = []
        candidate_ids: List[str] = []

        if self.supabase:
            try:
                # Fetch up to 200 unindexed URLs ordered by priority
                res = (
                    self.supabase.table("pseo_bot_wave_queue")
                    .select("id, url, priority")
                    .is_("indexed_at", "null")
                    .order("priority", desc=True)
                    .limit(200)
                    .execute()
                )
                rows = res.data or []
                for r in rows:
                    if r.get("url"):
                        candidate_urls.append(r["url"])
                        candidate_ids.append(r["id"])
            except Exception as err:
                logger.warning(f"Unable to read pseo_bot_wave_queue ({err}). Using fallback seeds.")

        if not candidate_urls:
            # Deterministic fallback URLs for validation
            candidate_urls = [
                f"https://salary.talentxcel.in/salary/software-engineer-in-bangalore-3-years",
                f"https://jobs.talentxcel.in/job/react-developer-in-hyderabad-with-typescript",
                f"https://careers.talentxcel.in/career-path/cloud-architect-roadmap-senior",
                f"https://chatr.ai/pricing",
                f"https://nutytales.com/products/kashmiri-mamra-almonds",
            ]

        batch_result = self.indexing_client.batch_submit(
            urls=candidate_urls,
            quota_used_today=quota_used,
        )

        # Mark submitted items in DB
        success_count = batch_result.get("success", 0)
        if success_count > 0 and self.supabase and candidate_ids:
            try:
                submitted_ids = candidate_ids[:success_count]
                self.supabase.table("pseo_bot_wave_queue").update({
                    "indexed_at": datetime.now(timezone.utc).isoformat(),
                    "status": "submitted_to_gsc",
                }).in_("id", submitted_ids).execute()
            except Exception as err:
                logger.error(f"Failed to update pseo_bot_wave_queue records: {err}")

        # Update telemetry quota counter
        if success_count > 0:
            self.telemetry.record_daily_metrics(
                hostname="talentxcel.in",
                analytics_rows=[],
                quota_increment=success_count,
                metric_date=today_str,
            )

        logger.info(f"=== Daily Google Indexing API Batch Finished: {batch_result} ===")

    def run_indexnow_batch(self):
        """
        Scheduled hourly.
        Submits newly created URLs from content_queue and programmatic SEO pages to IndexNow.
        """
        logger.info("=== Running Hourly IndexNow Batch Sweep ===")
        urls_by_host: Dict[str, List[str]] = {}

        if self.supabase:
            try:
                # Query recently created content_queue records with URLs
                res = (
                    self.supabase.table("content_queue")
                    .select("id, brand, media_file_path, published_url, created_at")
                    .gte("created_at", (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat())
                    .limit(500)
                    .execute()
                )
                rows = res.data or []
                for r in rows:
                    url = r.get("published_url")
                    brand = r.get("brand", "talentxcel")
                    default_host = f"{brand}.in" if brand != "chatr" else "chatr.ai"
                    if url and "http" in url:
                        host = url.replace("https://", "").replace("http://", "").split("/")[0]
                        urls_by_host.setdefault(host, []).append(url)
                    else:
                        urls_by_host.setdefault(default_host, []).append(f"https://{default_host}/c/{r.get('id')}")
            except Exception as err:
                logger.debug(f"Could not fetch recent content_queue URLs: {err}")

        # If empty, submit baseline domain endpoints
        if not urls_by_host:
            for host in FALLBACK_AUTHORITATIVE_HOSTNAMES[:3]:
                urls_by_host[host] = [f"https://{host}/", f"https://{host}/sitemap_index.xml"]

        for host, urls in urls_by_host.items():
            try:
                self.indexnow_client.submit_batch(hostname=host, urls=urls)
            except Exception as err:
                logger.error(f"Error submitting IndexNow batch for {host}: {err}")

        logger.info("=== Hourly IndexNow Batch Sweep Completed ===")

    def run_weekly_sitemap_submission(self):
        """
        Scheduled weekly (Sunday).
        Submits sitemap_index.xml across all registered authoritative domains.
        """
        logger.info("=== Running Weekly GSC Sitemap Submission Sweep ===")
        results = self.sitemap_submitter.submit_all_registered_sitemaps()
        logger.info(f"Weekly Sitemap Sweep completed: {len(results)} domains evaluated.")

def main():
    logger.info("Starting OmniPulse GSC Indexer Service (Autonomous Growth OS)...")
    orchestrator = GSCIndexerOrchestrator()

    # Perform initial dry run / warm up check
    logger.info("Executing initial warm-up telemetry and IndexNow verification...")
    try:
        orchestrator.run_indexnow_batch()
    except Exception as exc:
        logger.error(f"Error during warm-up IndexNow check: {exc}")

    # 1. Daily GSC telemetry collection at 6 AM IST (00:30 UTC)
    schedule.every().day.at("00:30").do(orchestrator.run_telemetry_collection)

    # 2. Daily Google Indexing API batch at 9 AM IST (03:30 UTC)
    schedule.every().day.at("03:30").do(orchestrator.run_indexing_api_batch)

    # 3. Hourly IndexNow batch
    schedule.every().hour.do(orchestrator.run_indexnow_batch)

    # 4. Weekly sitemap submission (Sunday at 01:00 UTC)
    schedule.every().sunday.at("01:00").do(orchestrator.run_weekly_sitemap_submission)

    logger.info("Scheduled jobs registered:")
    logger.info("  - GSC Telemetry Collection: Daily at 00:30 UTC (06:00 IST)")
    logger.info("  - Google Indexing API Batch: Daily at 03:30 UTC (09:00 IST)")
    logger.info("  - IndexNow URL Submission: Every hour")
    logger.info("  - GSC Sitemap Index Sweep: Every Sunday at 01:00 UTC")

    while running:
        schedule.run_pending()
        time.sleep(10)

    logger.info("OmniPulse GSC Indexer Service stopped.")

if __name__ == "__main__":
    main()
