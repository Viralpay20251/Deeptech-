import os
import re
import json
import logging
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger("trend_brain.ollama")

class OllamaAnalyzer:
    """
    Async client for local Ollama inference service.
    Generates viral video angles, hooks, and pSEO formats tailored for Indian audience.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 60.0,
    ):
        self.base_url = (
            base_url
            or os.getenv("OLLAMA_URL")
            or os.getenv("OLLAMA_BASE_URL")
            or "http://ollama:11434"
        ).rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.2:3b")
        self.timeout = timeout

    async def analyze_trend(self, query: str, brand: str) -> Dict[str, Any]:
        """
        Sends query to Ollama to generate viral angle, 3 hook lines, and format recommendation.
        Returns parsed dictionary with keys: angle, hooks (list of 3), format.
        """
        prompt = (
            f"Given this trending search query: '{query}', suggest: "
            f"1) A viral 60-second video angle for Indian audience, "
            f"2) Three high-retention hook lines, "
            f"3) The best pSEO content format (short_video/article/thread). "
            f"Keep it practical and specific. Brand: {brand}. "
            f"Format as JSON with keys: angle, hooks (array of 3), format"
        )

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
            },
        }

        url = f"{self.base_url}/api/generate"
        logger.info(f"Generating angle via Ollama ({self.model}) for '{query}' (brand: {brand})")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                raw_text = data.get("response", "")
                parsed = self._extract_json(raw_text)

                if self._validate_analysis(parsed):
                    return parsed
                else:
                    logger.warning(f"Ollama response failed validation, using sanitized fallback: {raw_text[:120]}")
                    return self._sanitize_or_fallback(parsed, query, brand)

        except Exception as exc:
            logger.error(f"Ollama inference error for query '{query}': {exc}. Using heuristic fallback.")
            return self._generate_fallback(query, brand)

    def _extract_json(self, text: str) -> Dict[str, Any]:
        """Extracts JSON object from text, handling markdown fences and extraneous characters."""
        text = text.strip()
        # Check for markdown code fences
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1).strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find outer braces
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start : end + 1])
                except json.JSONDecodeError:
                    pass
        return {}

    def _validate_analysis(self, data: Dict[str, Any]) -> bool:
        """Validates that parsed dict contains angle, 3 hooks, and format."""
        if not isinstance(data, dict):
            return False
        if not data.get("angle") or not isinstance(data["angle"], str):
            return False
        hooks = data.get("hooks")
        if not isinstance(hooks, list) or len(hooks) < 3:
            return False
        if not data.get("format") or not isinstance(data["format"], str):
            return False
        return True

    def _sanitize_or_fallback(self, parsed: Dict[str, Any], query: str, brand: str) -> Dict[str, Any]:
        """Ensures all required fields are populated even if model partially missed formatting."""
        fallback = self._generate_fallback(query, brand)
        angle = parsed.get("angle") if isinstance(parsed.get("angle"), str) else fallback["angle"]
        hooks = parsed.get("hooks") if isinstance(parsed.get("hooks"), list) and len(parsed.get("hooks", [])) >= 3 else fallback["hooks"]
        fmt = parsed.get("format") if isinstance(parsed.get("format"), str) else "short_video"

        # Ensure hooks are exactly 3 strings
        clean_hooks = [str(h).strip() for h in hooks[:3]]
        while len(clean_hooks) < 3:
            clean_hooks.append(f"Here is what nobody tells you about {query} in India today.")

        return {
            "angle": str(angle).strip(),
            "hooks": clean_hooks,
            "format": str(fmt).strip(),
        }

    def _generate_fallback(self, query: str, brand: str) -> Dict[str, Any]:
        """Deterministic high-quality fallback angles if local Ollama is offline."""
        brand_angles = {
            "talentxcel": {
                "angle": f"The hidden 2025 reality of '{query}' that tier-2 engineering colleges won't tell you.",
                "hooks": [
                    f"Stop applying for {query} until you see these salary benchmarks.",
                    f"Are companies still hiring for {query}? Here is the unvarnished data.",
                    f"If you are targeting {query} in 2025, do NOT make this resume mistake.",
                ],
                "format": "short_video",
            },
            "chatr": {
                "angle": f"How Indian D2C and MSMEs are cutting 70% support costs using {query}.",
                "hooks": [
                    f"Why Indian founders are replacing tier-1 support tickets with {query}.",
                    f"Is your business bleeding revenue on customer chats? Look at {query}.",
                    f"The 3-minute setup for {query} that doubled conversion rates.",
                ],
                "format": "short_video",
            },
            "nutytales": {
                "angle": f"Real Kashmiri heritage vs market counterfeit: What authentic '{query}' actually looks like.",
                "hooks": [
                    f"How to spot fake dry fruits when ordering {query} online.",
                    f"The centuries-old valley secret behind genuine Kashmiri {query}.",
                    f"Why pure Kashmiri {query} is the ultimate Indian corporate gift.",
                ],
                "format": "short_video",
            },
        }

        selected = brand_angles.get(brand)
        if not selected:
            selected = {
                "angle": f"Essential insights on {query} for forward-thinking Indian consumers.",
                "hooks": [
                    f"The biggest mistake people make with {query}.",
                    f"What you need to know about {query} before everyone else catches on.",
                    f"Here is why {query} is dominating Indian searches this week.",
                ],
                "format": "short_video",
            }

        return selected
