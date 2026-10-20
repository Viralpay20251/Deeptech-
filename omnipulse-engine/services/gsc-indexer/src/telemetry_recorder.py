import os
import logging
from datetime import datetime, timezone, date
from typing import Dict, Any, List, Optional
from supabase import create_client, Client

logger = logging.getLogger("gsc_indexer.telemetry_recorder")

class TelemetryRecorder:
    """
    Records and tracks Google Search Console performance metrics,
    index coverage health, rising queries, and daily API quota usage in Supabase gsc_telemetry.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
    ):
        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL")
        self.supabase_key = (
            supabase_key
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
        )
        self.supabase: Optional[Client] = None
        if self.supabase_url and self.supabase_key:
            try:
                self.supabase = create_client(self.supabase_url, self.supabase_key)
                logger.info("Supabase client initialized for TelemetryRecorder.")
            except Exception as err:
                logger.error(f"Failed to connect to Supabase: {err}")
        else:
            logger.warning("Supabase credentials not configured in TelemetryRecorder.")

    @staticmethod
    def compute_top_rising_queries(
        analytics_rows: List[Dict[str, Any]],
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Computes top rising and high-potential opportunity queries from search analytics.
        Prioritizes queries with:
        1. Striking distance position (positions 4 to 20).
        2. High impressions with low/medium CTR (untapped potential).
        3. Raw click volume.
        """
        if not analytics_rows:
            return []

        def calculate_velocity_score(row: Dict[str, Any]) -> float:
            pos = float(row.get("position", 100.0))
            impressions = int(row.get("impressions", 0))
            clicks = int(row.get("clicks", 0))

            # Striking distance bonus: position 4-15 gets maximum multiplier
            if 3.0 <= pos <= 15.0:
                pos_weight = 1.8
            elif 15.0 < pos <= 30.0:
                pos_weight = 1.2
            else:
                pos_weight = 0.6

            score = (impressions * 0.4 + clicks * 1.5) * pos_weight
            return score

        # Sort descending by calculated velocity score
        sorted_rows = sorted(analytics_rows, key=calculate_velocity_score, reverse=True)
        return sorted_rows[:limit]

    def get_quota_used_today(self, hostname: Optional[str] = None, target_date: Optional[str] = None) -> int:
        """
        Retrieves the Google Indexing API quota used today from gsc_telemetry.
        """
        metric_date = target_date or date.today().isoformat()

        if not self.supabase:
            return 0

        try:
            query = (
                self.supabase.table("gsc_telemetry")
                .select("quota_used_today")
                .eq("metric_date", metric_date)
            )
            if hostname:
                query = query.eq("hostname", hostname)

            res = query.execute()
            rows = res.data or []

            total_quota = sum(int(r.get("quota_used_today", 0)) for r in rows)
            return total_quota

        except Exception as err:
            logger.error(f"Error reading quota_used_today from Supabase: {err}")
            return 0

    def record_daily_metrics(
        self,
        hostname: str,
        analytics_rows: List[Dict[str, Any]],
        coverage_data: Optional[Dict[str, Any]] = None,
        quota_increment: int = 0,
        metric_date: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Upserts daily metrics for the given hostname into Supabase gsc_telemetry table.
        Aggregates clicks, impressions, CTR, average position, and rising queries.
        """
        target_date = metric_date or date.today().isoformat()
        clean_hostname = hostname.replace("https://", "").replace("http://", "").split("/")[0]

        # Calculate aggregates
        total_clicks = sum(int(r.get("clicks", 0)) for r in analytics_rows)
        total_impressions = sum(int(r.get("impressions", 0)) for r in analytics_rows)
        avg_ctr = (total_clicks / total_impressions) if total_impressions > 0 else 0.0

        if analytics_rows:
            avg_position = sum(float(r.get("position", 0.0)) for r in analytics_rows) / len(analytics_rows)
        else:
            avg_position = 0.0

        top_rising = self.compute_top_rising_queries(analytics_rows, limit=10)

        # Coverage details
        coverage = coverage_data or {}
        indexed_pages = int(coverage.get("indexed_pages", 0))
        error_pages = int(coverage.get("error_pages", 0))
        submitted_pages = int(coverage.get("submitted_pages", 0))

        # Check existing quota used today
        existing_quota = self.get_quota_used_today(clean_hostname, target_date)
        updated_quota = existing_quota + quota_increment

        record = {
            "hostname": clean_hostname,
            "metric_date": target_date,
            "total_clicks": total_clicks,
            "total_impressions": total_impressions,
            "average_ctr": round(avg_ctr, 4),
            "average_position": round(avg_position, 2),
            "indexed_pages": indexed_pages,
            "submitted_pages": submitted_pages,
            "error_pages": error_pages,
            "top_rising_queries": top_rising,
            "quota_used_today": updated_quota,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if self.supabase:
            try:
                self.supabase.table("gsc_telemetry").upsert(
                    record, on_conflict="hostname,metric_date"
                ).execute()
                logger.info(
                    f"Recorded daily GSC telemetry for {clean_hostname} ({target_date}): "
                    f"Clicks={total_clicks}, Impressions={total_impressions}, QuotaUsed={updated_quota}"
                )
            except Exception as err:
                logger.error(f"Error persisting gsc_telemetry to Supabase: {err}")
        else:
            logger.info(f"[Dry Run] GSC Telemetry for {clean_hostname}: {record}")

        return record
