import os
import time
import logging
from typing import Dict, Any, List, Optional
from google.auth.transport.requests import AuthorizedSession
from gsc_client import load_service_account_credentials

logger = logging.getLogger("gsc_indexer.indexing_api")

INDEXING_SCOPES = ["https://www.googleapis.com/auth/indexing"]
INDEXING_ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish"
DAILY_QUOTA_LIMIT = 200

class GoogleIndexingAPIClient:
    """
    Google Indexing API Client.
    Submits high-priority URLs to Google's real-time indexing pipeline.
    Enforces the strict 200 URLs/day per project quota.
    """

    def __init__(self, credentials=None):
        self.creds = credentials or load_service_account_credentials(INDEXING_SCOPES)
        self.session: Optional[AuthorizedSession] = None
        if self.creds:
            try:
                self.session = AuthorizedSession(self.creds)
                logger.info("Google Indexing API AuthorizedSession initialized successfully.")
            except Exception as err:
                logger.error(f"Failed to initialize Indexing API session: {err}")
        else:
            logger.warning("No credentials for Indexing API; running in dry-run/mock mode.")

    def submit_url(self, url: str, action_type: str = "URL_UPDATED") -> bool:
        """
        Submits a single URL notification to Google Indexing API.
        Payload: {"url": url, "type": action_type}
        Returns True on HTTP 200, False otherwise.
        """
        payload = {
            "url": url.strip(),
            "type": action_type,
        }

        if not self.session:
            logger.info(f"[Dry Run] Google Indexing API submit_url: {url} ({action_type})")
            return True

        try:
            resp = self.session.post(
                INDEXING_ENDPOINT,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=15.0,
            )

            if resp.status_code == 200:
                logger.info(f"Successfully submitted URL to Google Indexing API: {url}")
                return True
            else:
                logger.warning(
                    f"Indexing API rejected {url} (HTTP {resp.status_code}): {resp.text[:150]}"
                )
                return False

        except Exception as err:
            logger.error(f"Error calling Indexing API for {url}: {err}")
            return False

    def batch_submit(
        self,
        urls: List[str],
        quota_used_today: int = 0,
        quota_limit: int = DAILY_QUOTA_LIMIT,
    ) -> Dict[str, Any]:
        """
        Submits a batch of URLs while enforcing the daily 200 URL quota.
        Parameters:
            urls: list of candidate URLs to submit
            quota_used_today: current quota consumed today (read from telemetry)
            quota_limit: maximum allowable submissions per 24 hours (default 200)
        Returns:
            Dict with total submitted, success count, failure count, and new quota_used_today.
        """
        remaining_quota = max(0, quota_limit - quota_used_today)
        logger.info(
            f"Indexing API batch request: {len(urls)} URLs provided | "
            f"Quota used today: {quota_used_today}/{quota_limit} | Remaining: {remaining_quota}"
        )

        if remaining_quota <= 0:
            logger.warning("Daily Google Indexing API quota exhausted (200/day limit reached). Skipping batch.")
            return {
                "submitted": 0,
                "success": 0,
                "failed": 0,
                "skipped_quota": len(urls),
                "quota_used_today": quota_used_today,
            }

        candidates = urls[:remaining_quota]
        success_count = 0
        failure_count = 0

        for url in candidates:
            if not url or not url.startswith("http"):
                continue

            success = self.submit_url(url)
            if success:
                success_count += 1
            else:
                failure_count += 1

            # Mild rate-limiting pause between requests (100ms)
            time.sleep(0.1)

        new_quota_used = quota_used_today + success_count
        skipped_count = len(urls) - len(candidates)

        logger.info(
            f"Indexing API Batch Complete: Success={success_count}, Failed={failure_count}, "
            f"SkippedOverQuota={skipped_count}, TotalQuotaUsedToday={new_quota_used}"
        )

        return {
            "submitted": len(candidates),
            "success": success_count,
            "failed": failure_count,
            "skipped_quota": skipped_count,
            "quota_used_today": new_quota_used,
        }
