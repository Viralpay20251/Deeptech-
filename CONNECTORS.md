# Autonomous Growth OS — Connector Capability Matrix

## 1. Truth in Integration Status

The Autonomous Growth OS enforces **absolute honesty** in integration reporting:
- Connectors are only marked `connected` when credentials, endpoints, and health checks have passed.
- Missing credentials report truthfully as `awaiting_credentials` or `awaiting_oauth`.
- Missing endpoints or platform metrics are never simulated or represented as real data.

---

## 2. Capability Matrix

| Connector Type | Category | Implemented Status | Auth Method | Supported Capabilities | Known Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sitemap & RSS Web Inspector** | `search_web` | **Connected (Operational)** | None | `read_public` | Public pages only; respects `robots.txt` and SSRF blocks. |
| **Model Gateway (OpenAI / Anthropic)** | `ai_model` | **Connected (Operational)** | API Key / Simulator | `run_inference`, `generate_embedding` | Per-task budget capped at `$0.50`; deterministic simulator active for zero-credential tests. |
| **Google Search Console** | `search_web` | **Awaiting Credentials** | OAuth 2.0 | `read_analytics`, `read_insights` | 16-month historical window; anonymised queries omitted by Google. |
| **Bing Webmaster Tools** | `search_web` | **Awaiting Credentials** | API Key | `read_analytics`, `read_insights` | Bing search index data only. |
| **Google Analytics 4** | `analytics` | **Awaiting Credentials** | OAuth 2.0 | `read_analytics`, `read_insights` | Standard reporting latency of 24–48 hours; thresholding on low-volume events. |
| **LinkedIn Pages & Marketing** | `social_media` | **Awaiting Credentials** | OAuth 2.0 | `publish_post`, `schedule_post`, `read_insights` | Company page admin required; strict daily API rate limits. |
| **Meta (Instagram & Facebook)** | `social_media` | **Awaiting Credentials** | OAuth 2.0 | `publish_post`, `read_insights` | Meta App Review required for public page publishing permissions. |
| **YouTube Data API** | `social_media` | **Awaiting Credentials** | OAuth 2.0 | `read_insights`, `upload_media` | Strict daily API quota units (10,000 units/day default). |
| **Reddit API** | `social_media` | **Awaiting Credentials** | OAuth 2.0 | `read_public`, `read_insights` | Commercial API licensing terms apply for programmatic listening. |
| **X (Twitter) API v2** | `social_media` | **Awaiting Credentials** | OAuth 2.0 | `publish_post`, `read_insights` | Elevated/Basic tier quotas apply; monthly tweet caps enforced. |

---

## 3. Connector Authorisation Workflow

1. Operator registers client ID, secret, and approved scopes in secrets store or environment.
2. Connector status shifts from `not_configured` to `awaiting_oauth`.
3. Operator initiates OAuth flow via Control Plane API callback URL.
4. Token exchange occurs over TLS; encrypted token reference stored in database.
5. Connector executes automated health check. If successful, status transitions to `connected`.
6. Any token expiration or permission revocation transitions status immediately to `degraded` or `error` and triggers an operator alert.
