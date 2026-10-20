import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import redis
from supabase import create_client, Client

logger = logging.getLogger("trend_brain.persister")

class TrendPersister:
    """
    Handles score calculation, persistence to Supabase trend_signals,
    and pushing top opportunities to Redis for downstream distribution.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        redis_url: Optional[str] = None,
    ):
        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL")
        self.supabase_key = (
            supabase_key
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
        )
        self.redis_url = (
            redis_url
            or os.getenv("REDIS_URL")
            or "redis://redis:6379/0"
        )

        self.supabase: Optional[Client] = None
        if self.supabase_url and self.supabase_key:
            try:
                self.supabase = create_client(self.supabase_url, self.supabase_key)
                logger.info("Supabase client successfully initialized.")
            except Exception as err:
                logger.error(f"Failed to initialize Supabase client: {err}")
        else:
            logger.warning("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Operating in offline/mock mode.")

        self.redis_client: Optional[redis.Redis] = None
        try:
            self.redis_client = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
            )
            self.redis_client.ping()
            logger.info("Redis client connected successfully.")
        except Exception as err:
            logger.warning(f"Could not connect to Redis at {self.redis_url}: {err}. Caching locally.")
            self.redis_client = None

    @staticmethod
    def calculate_opportunity_score(search_volume: int, competition: float) -> float:
        """
        Calculates opportunity_score = (search_volume_estimate / 10000) * (1 - competition_score).
        """
        score = (float(search_volume) / 10000.0) * (1.0 - float(competition))
        return round(score, 4)

    def persist_trend_opportunity(
        self,
        brand: str,
        query: str,
        search_volume: int,
        competition: float,
        angle_data: Dict[str, Any],
        raw_results: List[Dict[str, str]],
    ) -> Optional[Dict[str, Any]]:
        """
        Validates opportunity score > 0.3. If qualified, upserts to Supabase trend_signals table.
        Returns the trend record if stored, else None.
        """
        opportunity_score = self.calculate_opportunity_score(search_volume, competition)
        logger.info(
            f"Trend '{query}' (brand: {brand}): Volume={search_volume}, "
            f"Competition={competition:.2f} -> OpportunityScore={opportunity_score:.4f}"
        )

        if opportunity_score <= 0.3:
            logger.info(f"Filtering out '{query}': Opportunity score {opportunity_score:.4f} <= 0.3 threshold.")
            return None

        record: Dict[str, Any] = {
            "brand_cluster": brand,
            "query": query,
            "search_volume_estimate": search_volume,
            "competition_score": competition,
            "opportunity_score": opportunity_score,
            "angle": angle_data.get("angle", ""),
            "hooks": angle_data.get("hooks", []),
            "format": angle_data.get("format", "short_video"),
            "raw_results": raw_results,
            "status": "ready",
            "discovered_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Persist to Supabase if available
        if self.supabase:
            try:
                # Upsert into trend_signals table
                res = self.supabase.table("trend_signals").upsert(
                    record, on_conflict="brand_cluster,query"
                ).execute()
                logger.info(f"Successfully upserted trend signal '{query}' for brand '{brand}' in Supabase.")
            except Exception as err:
                logger.error(f"Error persisting trend signal to Supabase: {err}")
        else:
            logger.info(f"[Dry Run] Persisted trend signal '{query}' locally (OpportunityScore: {opportunity_score})")

        return record

    def publish_top_opportunities(self, brand: str, opportunities: List[Dict[str, Any]]) -> int:
        """
        Pushes top 3 opportunities to Redis list omnipulse:trends:{brand_cluster} (LPUSH, keep max 50 items with LTRIM).
        Returns number of items published.
        """
        if not opportunities:
            return 0

        # Sort descending by opportunity_score
        sorted_opps = sorted(
            opportunities,
            key=lambda x: x.get("opportunity_score", 0.0),
            reverse=True,
        )
        top_3 = sorted_opps[:3]
        redis_key = f"omnipulse:trends:{brand}"

        if not self.redis_client:
            logger.warning(f"Redis not available; skipping LPUSH to {redis_key}. Top 3: {[o['query'] for o in top_3]}")
            return len(top_3)

        published_count = 0
        try:
            for item in reversed(top_3): # reverse so top item remains at head after LPUSH
                payload = json.dumps(item)
                self.redis_client.lpush(redis_key, payload)
                published_count += 1

            # Keep max 50 items
            self.redis_client.ltrim(redis_key, 0, 49)
            logger.info(f"Published {published_count} trend signals to Redis key '{redis_key}' (trimmed to 50)")

        except Exception as err:
            logger.error(f"Failed to publish trends to Redis '{redis_key}': {err}")

        return published_count
