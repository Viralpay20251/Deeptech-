import os
import json
import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import redis
from supabase import create_client, Client

from script_generator import ScriptGenerator
from tts_engine import generate_tts_sync
from thumbnail_generator import generate_thumbnail
from video_assembler import assemble_video
from caption_generator import generate_captions

logger = logging.getLogger("media_factory.queue_worker")

SOCIAL_PLATFORMS = ["youtube", "instagram", "linkedin", "twitter", "facebook"]

class QueueWorker:
    """
    Autonomous pipeline worker that consumes pending content scripts,
    generates TTS voiceovers, creates branded 9:16 vertical thumbnails,
    assembles 60s MP4 videos with FFmpeg, transcribes subtitles with faster-whisper,
    updates Supabase status to 'media_ready', and notifies Redis distributors.
    """

    def __init__(
        self,
        storage_dir: Optional[str] = None,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        redis_url: Optional[str] = None,
    ):
        self.storage_dir = (
            storage_dir
            or os.getenv("MEDIA_STORAGE_DIR")
            or os.path.join(os.getcwd(), "media_output")
        )
        os.makedirs(self.storage_dir, exist_ok=True)

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
                logger.info("Supabase client initialized for QueueWorker.")
            except Exception as err:
                logger.error(f"Failed to initialize Supabase client: {err}")

        self.redis_client: Optional[redis.Redis] = None
        try:
            self.redis_client = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
            )
            self.redis_client.ping()
            logger.info("Redis client connected for QueueWorker.")
        except Exception as err:
            logger.warning(f"Redis not reachable at {self.redis_url}: {err}")

        self.script_gen = ScriptGenerator(
            supabase_url=self.supabase_url,
            supabase_key=self.supabase_key,
            redis_url=self.redis_url,
        )

    def fetch_pending_items(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Polls Supabase content_queue WHERE status='pending' AND script_text IS NOT NULL.
        If empty, attempts to pop trends from Redis and create pending items.
        """
        items: List[Dict[str, Any]] = []

        if self.supabase:
            try:
                res = (
                    self.supabase.table("content_queue")
                    .select("*")
                    .eq("status", "pending")
                    .not_.is_("script_text", "null")
                    .order("created_at")
                    .limit(limit)
                    .execute()
                )
                items = res.data or []
            except Exception as err:
                logger.error(f"Error fetching pending items from Supabase: {err}")

        # If Supabase returned fewer than limit, check Redis trend queues
        if len(items) < limit and self.redis_client:
            brands = ["talentxcel", "chatr", "nutytales"]
            for brand in brands:
                if len(items) >= limit:
                    break
                trend = self.script_gen.fetch_pending_trend_from_redis(brand)
                if trend:
                    queued = self.script_gen.queue_trend_to_content_queue(trend)
                    if queued:
                        items.append(queued)

        return items

    def process_item(self, item: Dict[str, Any]) -> bool:
        """
        Executes media processing pipeline for a single item:
        1. Parse script & extract hook
        2. Generate TTS (MP3)
        3. Generate Thumbnail (JPEG)
        4. Assemble Video (MP4)
        5. Generate Subtitles (SRT)
        6. Update Supabase record
        7. Push to Redis for distributors
        """
        item_id = str(item.get("id", f"media_{int(time.time() * 1000)}"))
        brand = item.get("brand") or item.get("brand_cluster", "talentxcel")
        script_text = item.get("script_text", "").strip()

        if not script_text:
            logger.warning(f"Item {item_id} has empty script_text, skipping.")
            return False

        logger.info(f"[{datetime.now(timezone.utc).isoformat()}] Processing item {item_id} (brand: {brand})")

        # 1. Parse and extract hook line
        parsed_script = self.script_gen.parse_and_segment_script(script_text)
        hook_line = item.get("hook_line") or parsed_script["hook"]
        clean_script = parsed_script["full_script"]

        # Output paths
        audio_path = os.path.join(self.storage_dir, f"{item_id}_audio.mp3")
        thumb_path = os.path.join(self.storage_dir, f"{item_id}_thumb.jpg")
        video_path = os.path.join(self.storage_dir, f"{item_id}_video.mp4")
        captions_path = os.path.join(self.storage_dir, f"{item_id}_captions.srt")

        try:
            # Step a: Generate TTS from script_text
            t0 = time.time()
            generate_tts_sync(clean_script, audio_path, brand=brand)
            logger.info(f"Step a (TTS) completed in {time.time() - t0:.2f}s -> {audio_path}")

            # Step b: Generate Thumbnail (brand colors + hook_line text)
            t1 = time.time()
            generate_thumbnail(hook_line, thumb_path, brand=brand)
            logger.info(f"Step b (Thumbnail) completed in {time.time() - t1:.2f}s -> {thumb_path}")

            # Step c: Assemble Video (FFmpeg)
            t2 = time.time()
            assemble_video(thumb_path, audio_path, video_path, hook_text=hook_line)
            logger.info(f"Step c (Video) completed in {time.time() - t2:.2f}s -> {video_path}")

            # Step d: Generate Captions (faster-whisper)
            t3 = time.time()
            generate_captions(audio_path, captions_path)
            logger.info(f"Step d (Captions) completed in {time.time() - t3:.2f}s -> {captions_path}")

            # Step e: Update Supabase row
            update_payload = {
                "media_file_path": video_path,
                "thumbnail_path": thumb_path,
                "captions_path": captions_path,
                "audio_path": audio_path,
                "status": "media_ready",
                "hook_line": hook_line,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            if self.supabase:
                try:
                    self.supabase.table("content_queue").update(update_payload).eq("id", item_id).execute()
                    logger.info(f"Updated Supabase row {item_id} to status='media_ready'")
                except Exception as db_err:
                    logger.error(f"Failed to update Supabase row {item_id}: {db_err}")

            # Step 3: Push to Redis omnipulse:media_ready:{brand}:{platform} list
            self.publish_to_distributors(item_id, brand, update_payload, item)

            logger.info(f"[{datetime.now(timezone.utc).isoformat()}] Item {item_id} completed successfully.")
            return True

        except Exception as proc_err:
            logger.error(f"Pipeline failed for item {item_id}: {proc_err}", exc_info=True)
            if self.supabase:
                try:
                    self.supabase.table("content_queue").update({
                        "status": "failed",
                        "error_message": str(proc_err),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", item_id).execute()
                except Exception:
                    pass
            return False

    def publish_to_distributors(
        self,
        item_id: str,
        brand: str,
        media_info: Dict[str, Any],
        original_item: Dict[str, Any],
    ):
        """
        Pushes media_ready notifications to Redis for social distribution engines.
        Key pattern: omnipulse:media_ready:{brand}:{platform}
        """
        if not self.redis_client:
            logger.debug("Redis client offline, skipping distributor event dispatch.")
            return

        payload = {
            "content_id": item_id,
            "brand": brand,
            "title": original_item.get("title", "OmniPulse Video"),
            "hook_line": media_info.get("hook_line"),
            "media_file_path": media_info.get("media_file_path"),
            "thumbnail_path": media_info.get("thumbnail_path"),
            "captions_path": media_info.get("captions_path"),
            "ready_at": datetime.now(timezone.utc).isoformat(),
        }

        for platform in SOCIAL_PLATFORMS:
            channel_key = f"omnipulse:media_ready:{brand}:{platform}"
            try:
                self.redis_client.lpush(channel_key, json.dumps(payload))
                # Keep max 100 items per platform queue
                self.redis_client.ltrim(channel_key, 0, 99)
                logger.info(f"Queued media_ready event -> Redis '{channel_key}'")
            except Exception as err:
                logger.error(f"Failed to push to Redis {channel_key}: {err}")

    def run_cycle(self, max_items: int = 5) -> int:
        """Runs a single polling cycle. Returns count of items processed."""
        pending_items = self.fetch_pending_items(limit=max_items)
        if not pending_items:
            return 0

        logger.info(f"Found {len(pending_items)} pending items in content queue. Starting media generation...")
        success_count = 0
        for item in pending_items:
            if self.process_item(item):
                success_count += 1

        return success_count
