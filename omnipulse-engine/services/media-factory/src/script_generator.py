import os
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
import redis
from supabase import create_client, Client

logger = logging.getLogger("media_factory.script_generator")

BRAND_DEFAULT_CTAS = {
    "talentxcel": "Check your tech salary benchmark today on TalentXcel.in. Follow for more career truth.",
    "chatr": "Automate your customer conversations today at Chatr.ai. Link in bio.",
    "nutytales": "Experience authentic Kashmiri heritage gifts at NutyTales.com. Order direct from the valley.",
}

class ScriptGenerator:
    """
    Manages script preparation, validation, word truncation, and segmenting
    into Hook (first 15 words), Body, and CTA (last 10 words).
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
        self.redis_url = redis_url or os.getenv("REDIS_URL") or "redis://redis:6379/0"

        self.supabase: Optional[Client] = None
        if self.supabase_url and self.supabase_key:
            try:
                self.supabase = create_client(self.supabase_url, self.supabase_key)
            except Exception as err:
                logger.error(f"Failed to connect to Supabase: {err}")

        self.redis_client: Optional[redis.Redis] = None
        try:
            self.redis_client = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
            )
            self.redis_client.ping()
        except Exception as err:
            logger.warning(f"Redis not available at {self.redis_url}: {err}")
            self.redis_client = None

    @staticmethod
    def parse_and_segment_script(raw_text: str) -> Dict[str, str]:
        """
        Processes script text:
        1. Truncates to maximum 150 words (60s speech limit).
        2. Splits into hook (first 15 words), body, and CTA (last 10 words).
        """
        words = raw_text.strip().split()
        if not words:
            return {"hook": "", "body": "", "cta": "", "full_script": ""}

        # Truncate to 150 words max
        if len(words) > 150:
            words = words[:150]

        full_script = " ".join(words)

        if len(words) <= 25:
            # Short script edge case
            hook_len = min(10, len(words))
            hook = " ".join(words[:hook_len])
            cta = " ".join(words[hook_len:])
            body = ""
        else:
            hook = " ".join(words[:15])
            cta = " ".join(words[-10:])
            body = " ".join(words[15:-10])

        return {
            "hook": hook,
            "body": body,
            "cta": cta,
            "full_script": full_script,
            "word_count": len(words),
        }

    def fetch_pending_from_supabase(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Polls Supabase content_queue table WHERE status='pending' AND media_file_path IS NULL.
        """
        if not self.supabase:
            logger.debug("Supabase client unavailable, skipping DB poll.")
            return []

        try:
            res = (
                self.supabase.table("content_queue")
                .select("*")
                .eq("status", "pending")
                .is_("media_file_path", "null")
                .limit(limit)
                .execute()
            )
            rows = res.data or []
            logger.info(f"Fetched {len(rows)} pending items from Supabase content_queue")
            return rows
        except Exception as err:
            logger.error(f"Error querying content_queue from Supabase: {err}")
            return []

    def fetch_pending_trend_from_redis(self, brand: str) -> Optional[Dict[str, Any]]:
        """
        Pops a pending trend signal from Redis list omnipulse:trends:{brand} (RPOP).
        """
        if not self.redis_client:
            return None

        key = f"omnipulse:trends:{brand}"
        try:
            raw = self.redis_client.rpop(key)
            if not raw:
                return None
            return json.loads(raw)
        except Exception as err:
            logger.error(f"Error popping trend from Redis key {key}: {err}")
            return None

    def synthesize_script_from_trend(self, trend_item: Dict[str, Any]) -> str:
        """
        Synthesizes a 120-150 word video script from a trend item containing angle and hooks.
        """
        brand = trend_item.get("brand_cluster") or trend_item.get("brand", "talentxcel")
        query = trend_item.get("query", "Top Industry Trends")
        angle = trend_item.get("angle", f"Important updates regarding {query} in India.")
        hooks = trend_item.get("hooks", [])
        hook_text = hooks[0] if hooks else f"Here is the real truth about {query} you won't hear elsewhere."
        cta = BRAND_DEFAULT_CTAS.get(brand, "Follow for more daily updates and insights.")

        body = (
            f"{angle} Industry data across India shows significant shifts in how professionals "
            f"and companies are handling {query}. If you are navigating this market, focus on "
            f"verifiable skills and direct execution rather than generic advice. Thousands of "
            f"people overlook the critical details until it is too late."
        )

        full_draft = f"{hook_text} {body} {cta}"
        parsed = self.parse_and_segment_script(full_draft)
        return parsed["full_script"]

    def queue_trend_to_content_queue(self, trend_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Transforms a Redis trend into a pending content_queue record in Supabase.
        """
        brand = trend_item.get("brand_cluster") or trend_item.get("brand", "talentxcel")
        script = self.synthesize_script_from_trend(trend_item)
        parsed = self.parse_and_segment_script(script)

        record = {
            "brand": brand,
            "title": trend_item.get("query", "Viral Short"),
            "script_text": script,
            "hook_line": parsed["hook"],
            "status": "pending",
            "metadata": {
                "source": "trend_brain",
                "angle": trend_item.get("angle"),
                "hooks": trend_item.get("hooks"),
                "format": trend_item.get("format", "short_video"),
                "opportunity_score": trend_item.get("opportunity_score"),
            },
        }

        if self.supabase:
            try:
                res = self.supabase.table("content_queue").insert(record).execute()
                if res.data:
                    return res.data[0]
            except Exception as err:
                logger.error(f"Failed to insert trend into content_queue: {err}")

        # Fallback dictionary for local runner
        record["id"] = f"local-{int(os.times()[4] * 1000)}"
        return record
