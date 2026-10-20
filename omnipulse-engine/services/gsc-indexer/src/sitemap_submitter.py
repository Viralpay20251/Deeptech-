import os
import logging
from typing import Dict, Any, List, Optional
from googleapiclient.errors import HttpError
from supabase import create_client, Client
from gsc_client import GSCClient

logger = logging.getLogger("gsc_indexer.sitemap_submitter")

# Fallback authoritative hostnames with index submission enabled
FALLBACK_AUTHORITATIVE_HOSTNAMES = [
    "talentxcel.in",
    "jobs.talentxcel.in",
    "salary.talentxcel.in",
    "careers.talentxcel.in",
    "colleges.talentxcel.in",
    "resume.talentxcel.in",
    "chatr.ai",
    "nutytales.com",
]

class SitemapSubmitter:
    """
    Submits sitemap_index.xml for all registered domains where allowed_for_index_submission = TRUE.
    Checks existing GSC sitemap submissions to prevent duplicate feed registrations.
    """

    def __init__(
        self,
        gsc_client: Optional[GSCClient] = None,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
    ):
        self.gsc = gsc_client or GSCClient()
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
            except Exception as err:
                logger.error(f"Failed to connect to Supabase: {err}")

    def fetch_allowed_hostnames(self) -> List[Dict[str, str]]:
        """
        Fetches hostnames from registered_domains where allowed_for_index_submission = TRUE.
        """
        if self.supabase:
            try:
                res = (
                    self.supabase.table("registered_domains")
                    .select("hostname, search_console_property_uri")
                    .eq("allowed_for_index_submission", True)
                    .execute()
                )
                if res.data:
                    return res.data
            except Exception as err:
                logger.error(f"Error querying registered_domains for index submission: {err}")

        # Fallback inventory
        return [
            {
                "hostname": host,
                "search_console_property_uri": f"sc-domain:{host}",
            }
            for host in FALLBACK_AUTHORITATIVE_HOSTNAMES
        ]

    def get_existing_sitemaps(self, property_uri: str) -> List[str]:
        """
        Lists all sitemaps already registered in GSC for the specified site property.
        """
        if not self.gsc.service:
            return []

        try:
            res = self.gsc.service.sitemaps().list(siteUrl=property_uri).execute()
            sitemaps = res.get("sitemap", [])
            paths = [sm.get("path", "").strip() for sm in sitemaps]
            return paths
        except HttpError as err:
            logger.warning(f"Unable to list existing sitemaps for {property_uri}: {err}")
            return []
        except Exception as err:
            logger.error(f"Unexpected error listing sitemaps for {property_uri}: {err}")
            return []

    def submit_domain_sitemap(self, hostname: str, property_uri: Optional[str] = None) -> Dict[str, Any]:
        """
        Submits https://{hostname}/sitemap_index.xml to GSC if not already registered.
        """
        clean_hostname = hostname.replace("https://", "").replace("http://", "").split("/")[0]
        sitemap_url = f"https://{clean_hostname}/sitemap_index.xml"
        site_property = property_uri or f"sc-domain:{clean_hostname}"

        logger.info(f"Checking sitemap status for {clean_hostname} (Property: {site_property})")

        if not self.gsc.service:
            logger.info(f"[Dry Run] Sitemap submission for {clean_hostname}: {sitemap_url}")
            return {
                "hostname": clean_hostname,
                "sitemap_url": sitemap_url,
                "status": "dry_run",
                "submitted": True,
            }

        existing_paths = self.get_existing_sitemaps(site_property)
        if sitemap_url in existing_paths or any(clean_hostname in p and "sitemap" in p for p in existing_paths):
            logger.info(f"Sitemap already registered for {clean_hostname}: {sitemap_url} (Skipping duplicate)")
            return {
                "hostname": clean_hostname,
                "sitemap_url": sitemap_url,
                "status": "already_submitted",
                "submitted": False,
            }

        try:
            self.gsc.service.sitemaps().submit(
                siteUrl=site_property,
                feedpath=sitemap_url,
            ).execute()

            logger.info(f"Successfully submitted sitemap to GSC: {sitemap_url}")
            return {
                "hostname": clean_hostname,
                "sitemap_url": sitemap_url,
                "status": "submitted_successfully",
                "submitted": True,
            }

        except HttpError as err:
            logger.error(f"GSC sitemap submission failed for {clean_hostname} ({sitemap_url}): {err}")
            return {
                "hostname": clean_hostname,
                "sitemap_url": sitemap_url,
                "status": "submission_error",
                "error": str(err),
                "submitted": False,
            }

    def submit_all_registered_sitemaps(self) -> List[Dict[str, Any]]:
        """
        Submits sitemap_index.xml across all active, index-allowed domains.
        """
        domains = self.fetch_allowed_hostnames()
        logger.info(f"Starting sitemap submission sweep across {len(domains)} registered domains...")

        results = []
        for domain_row in domains:
            hostname = domain_row.get("hostname", "")
            prop_uri = domain_row.get("search_console_property_uri")
            if not hostname:
                continue

            res = self.submit_domain_sitemap(hostname, prop_uri)
            results.append(res)

        return results
