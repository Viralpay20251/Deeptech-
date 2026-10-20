import os
import logging
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger("gsc_indexer.indexnow")

INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
MAX_URLS_PER_BATCH = 10000

class IndexNowClient:
    """
    Client for the IndexNow protocol (supported by Bing, Yandex, Seznam, Naver).
    Notifies search engines instantly when programmatic SEO URLs are created or refreshed.
    """

    def __init__(self, default_key: Optional[str] = None, timeout: float = 30.0):
        self.default_key = (
            default_key
            or os.getenv("INDEXNOW_KEY")
            or "omnipulse-indexnow-master-key-2025"
        )
        self.timeout = timeout

    def submit_batch(
        self,
        hostname: str,
        urls: List[str],
        key: Optional[str] = None,
        key_location: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Submits a batch of URLs to IndexNow.
        Splits lists larger than 10,000 into compliant chunks.
        Body format: {"host": hostname, "key": key, "urlList": urls}
        Returns summary of submission results.
        """
        active_key = key or self.default_key
        clean_hostname = hostname.replace("https://", "").replace("http://", "").split("/")[0]

        if not urls:
            logger.info(f"No URLs to submit for host {clean_hostname}.")
            return {"status": "noop", "total_urls": 0, "batches": 0}

        # Filter URLs ensuring they belong to hostname
        valid_urls = [u for u in urls if clean_hostname in u]
        if not valid_urls:
            valid_urls = urls  # Proceed if already relative or path verified

        # Chunk into batches of up to 10,000 URLs
        chunks = [
            valid_urls[i : i + MAX_URLS_PER_BATCH]
            for i in range(0, len(valid_urls), MAX_URLS_PER_BATCH)
        ]

        logger.info(
            f"IndexNow: Submitting {len(valid_urls)} URLs for {clean_hostname} in {len(chunks)} batch(es)."
        )

        batch_results = []
        overall_success = True

        for idx, chunk in enumerate(chunks, 1):
            payload: Dict[str, Any] = {
                "host": clean_hostname,
                "key": active_key,
                "urlList": chunk,
            }
            if key_location:
                payload["keyLocation"] = key_location

            try:
                with httpx.Client(timeout=self.timeout) as client:
                    resp = client.post(
                        INDEXNOW_ENDPOINT,
                        json=payload,
                        headers={"Content-Type": "application/json; charset=utf-8"},
                    )

                    status = resp.status_code
                    logger.info(
                        f"IndexNow batch {idx}/{len(chunks)} for {clean_hostname} "
                        f"({len(chunk)} URLs): HTTP {status}"
                    )

                    # 200 (OK) and 202 (Accepted) are standard success codes
                    is_ok = status in (200, 202)
                    if not is_ok:
                        overall_success = False

                    batch_results.append({
                        "batch": idx,
                        "url_count": len(chunk),
                        "status_code": status,
                        "response_preview": resp.text[:120],
                    })

            except Exception as err:
                logger.error(f"Error submitting IndexNow batch {idx} for {clean_hostname}: {err}")
                overall_success = False
                batch_results.append({
                    "batch": idx,
                    "url_count": len(chunk),
                    "status_code": 0,
                    "error": str(err),
                })

        return {
            "status": "success" if overall_success else "partial_failure",
            "host": clean_hostname,
            "total_urls": len(valid_urls),
            "batches_submitted": len(chunks),
            "batch_details": batch_results,
        }
