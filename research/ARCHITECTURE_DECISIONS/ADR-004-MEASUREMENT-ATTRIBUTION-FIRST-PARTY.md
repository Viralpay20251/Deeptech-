# ADR-004: First-Party Measurement & Transparent Attribution Engine

## Status
**Accepted** (13 October 2026)

## Context
A primary non-negotiable constraint is **Zero Modification of existing CHATR, TalentXcel, or Nuty Tales codebases or production databases**. We need to attribute traffic and measure outcomes without injecting client tracking tags into their applications.

We evaluated three alternatives:
1. **OS-Owned Transparent Redirect Router (`/r/:short_code`) (Adopted):** Inbound traffic to OS properties is redirected outward to destination platforms with standard UTMs (`utm_source=growth_os&utm_campaign=...`). Clicks, bot headers, and referrers are logged before issuing HTTP 302 redirects.
2. **Third-Party Commercial Link Shortener (Bitly / Dub):** External SaaS link management.
3. **Client-Side Script Injection (Rejected):** Adding Google Tag Manager or PostHog scripts to `chatr.ai`, `talentxcel.com`, or `nutytales.com`.

## Decision
Adopt an internal **OS-Owned Transparent Redirect Engine (`/r/:short_code`)** coupled with read-only GA4 Data API ingestion for destination platform verification.

## Consequences
- **Positive:** 100% boundary compliance; absolute independence from destination repositories; complete control over bot filtering and UTM logging.
- **Tradeoff:** Outbound click attribution measures entry to destination domains; downstream activation (e.g. completed job application or e-commerce purchase) is reconciled periodically via read-only analytics exports.
