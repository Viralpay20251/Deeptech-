# Autonomous Growth OS — External Connector Capability & Feasibility Matrix

**Snapshot Date:** 13 October 2026  
**Auditor:** Social-Media & Search Integrations Architect  
**Specification Reference:** Master Build Prompt Section 26.2, Section 29, and Section 36  

---

## 1. Truth in Integration Status Taxonomy

Every connector is categorized under strictly one status:
- `connected`: Endpoint verified, credentials loaded, automated health check passing.
- `awaiting_credentials`: Adapter code implemented, awaiting environment API key or secret.
- `awaiting_oauth`: Adapter implemented, awaiting OAuth client registration and user consent.
- `app_review_required`: Requires formal platform review / business verification before production access.
- `blocked_by_terms`: Official platform terms restrict commercial automated use without separate contract.
- `paid_access_required`: API access requires enterprise tier or usage billing.

---

## 2. Comprehensive Connector Audit Matrix

| Connector | Documented Base URL & Version | Required Scopes / Auth | Official Quota & Rate Limits | Implemented Capabilities | Current Status | Compliant Fallback / Workaround |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Sitemap & RSS Web Inspector** | `https://*` (Public web) | None (Public HTTP GET) | Per-host token bucket (1 req / 2s); robots.txt | `read_public` | **Connected (Operational)** | Fallback to manual URL submission if crawler blocked. |
| **Model Gateway** | Multi-provider (`api.openai.com`, `api.anthropic.com`) | API Key / Simulator | Rate limits per provider tier; $\$0.50$/task cap | `run_inference`, `generate_embedding` | **Connected (Operational)** | Deterministic zero-credential simulator for offline tests. |
| **Google Search Console** | `searchconsole.googleapis.com/v1` | `webmasters.readonly` (OAuth 2.0) | 1,200 QPM per project; 16-month historical limit | `read_analytics`, `read_insights` | **Awaiting OAuth** | Export CSV manually or rely on Bing Webmaster Tools. |
| **Google Analytics 4** | `analyticsdata.googleapis.com/v1beta` | `analytics.readonly` (OAuth 2.0) | 10,000 requests/day per property; 24–48h latency | `read_analytics`, `read_insights` | **Awaiting OAuth** | Manual BigQuery or CSV export of daily active users. |
| **Bing Webmaster Tools** | `ssl.bing.com/webmaster/api.svc/json` | API Key (Bing Webmaster Portal) | 100 requests/minute | `read_analytics`, `read_insights` | **Awaiting Credentials** | Manual XML/CSV performance export. |
| **LinkedIn Pages & Marketing** | `api.linkedin.com/rest/posts` (Header: `X-Restli-Protocol-Version: 2.0.0`) | `w_organization_social`, `r_organization_social` | 50 posts/day per company page; App Review required | `publish_post`, `schedule_post`, `read_insights` | **Awaiting OAuth & App Review** | "Export Approved Post Package" button for manual operator publication. |
| **Meta Graph API (Instagram/FB)** | `graph.facebook.com/v20.0` | `instagram_content_publish`, `pages_manage_posts` | 200 calls/hour per user; Business Verification | `publish_post`, `read_insights` | **App Review Required** | "Export Approved Creative Package" for manual Instagram/Facebook post. |
| **YouTube Data API** | `youtube.googleapis.com/v3` | `youtube.upload`, `youtube.readonly` | 10,000 quota units/day default (Videos.insert = 1,600 units) | `upload_media`, `read_insights` | **Awaiting OAuth** | Generate storyboard and script for manual studio upload. |
| **TikTok Content Posting** | `open.tiktokapis.com/v2/post/publish` | `video.publish` (OAuth 2.0) | Direct Post API audit required. Unaudited apps restricted to **private** visibility | `upload_media` (Private only) | **App Review Required** | Video concept brief and caption export for creator workflow. |
| **Reddit Data API** | `oauth.reddit.com` | OAuth 2.0 (Developer App) | 100 QPM; **Terms revised 20 July 2026 prohibit commercial listening without contract** | `read_public` (Restricted) | **Blocked by Terms** | Rely on official public RSS feeds or manual community research. |
| **X (Twitter) API v2** | `api.x.com/2` | OAuth 2.0 / Bearer Token | Basic tier: 100 tweets/month ($100/mo); Pro: 5,000 tweets ($5,000/mo) | `publish_post`, `read_insights` | **Paid Access Required** | Export thread draft for operator manual publication. |
| **Telegram Bot API** | `api.telegram.org/bot<token>` | Bot Token (HTTP API) | 30 messages/second globally; **Cannot initiate DM to user without user start** | `publish_post`, `send_notification` | **Awaiting Credentials** | Broadcast only to verified opt-in public channels. |
| **Discord Bot API** | `discord.com/api/v10` | Bot Token; **Self-bots strictly prohibited by Discord terms** | 50 requests/second per bot | `publish_post`, `read_public` | **Awaiting Credentials** | Community announcements in owned OS testing servers. |

---

## 3. Human Gate & Guarding Rules

1. **Zero Secret Storage:** API tokens and client secrets are referenced via secure environment variables (`env:LINKEDIN_CLIENT_SECRET`), never stored in database tables or logs.
2. **Synchronous Scope Verification:** Before invoking any outbound publishing API, the connector asserts:
   - Target brand has configured this channel in `allowed_channels`.
   - Content asset possesses a valid, non-expired human approval event ID (`assertPublishingApproved()`).
   - Daily channel frequency cap has not been breached.
3. **Graceful Fallback Guarantee:** When API authorization is pending or revoked, the UI renders a fully validated **"Approved Asset Export"** package containing markdown copy, media assets, UTM tracking links, and recommended posting times.
