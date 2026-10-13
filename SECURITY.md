# Autonomous Growth OS — Security & Privacy Architecture

## 1. Threat Model & Mitigations

| Threat | Attack Vector | Technical Mitigation |
| :--- | :--- | :--- |
| **Accidental Production Modification** | OS connects to existing CHATR, TalentXcel, or Nuty Tales databases. | `assertNotProtectedDatabase()` verifies host against `PROTECTED_DB_HOSTS`. Aborts before connection pool creation. |
| **SSRF via Web Connectors** | Malicious sitemap URL directs crawler to `169.254.169.254` (cloud metadata). | `assertSafeOutboundUrl()` blocks cloud metadata, loopback (`localhost`), and RFC1918 private IP ranges synchronously. |
| **Prompt Injection** | Fetched external content contains adversarial system override prompts. | `detectPromptInjection()` scans for override tokens; `sanitiseExternalContent()` encapsulates untrusted text in strict data delimiters. |
| **Secret Leakage in Logs** | API keys or OAuth tokens printed in logs or client bundles. | Pino logger configured with `redact.paths` covering credentials, tokens, cookies, and secrets. |
| **Unauthorised Publishing** | Rogue or confused agent publishes unapproved marketing content. | `assertPublishingApproved()` strictly requires a valid, unexpired `approval_event_id` in database before any external action. |
| **Cross-Tenant Data Leakage** | Future customer tenant accesses another tenant's metrics or prompts. | Strict tenant scoping (`workspace_id`) on all database tables and queries. Commercial onboarding disabled until Gate F. |

---

## 2. Emergency Kill Switches

The OS implements a multi-tier emergency stop framework:
- **Global:** Halts all workflow runs and outbound actions immediately across the entire OS.
- **Brand:** Halts actions for a specific brand (e.g. during brand redesign or sensitive incident).
- **Channel:** Halts actions on a specific platform (e.g. during an API policy change on LinkedIn or X).
- **Campaign:** Halts a specific campaign.

Every task attempt synchronously checks for active kill switches before invoking any tool or model call.

---

## 3. Secret Management & Storage Rules

- **Zero Hard-coded Secrets:** Secrets must be supplied via runtime environment variables or an enterprise secrets manager.
- **Database References Only:** Database tables store `credential_reference` strings (e.g. `env:OPENAI_API_KEY`), never raw secret values.
- **Pre-flight CI Check:** `scripts/safety-check.js` scans source files for private keys, AWS tokens, or GitHub tokens before builds.

---

## 4. Privacy & Compliance

- **No Unsolicited Bulk Messaging:** Anti-spam rules strictly prohibit automated cold DM scraping or mass messaging.
- **Consent-First Communication:** Newsletters and notifications require documented opt-in consent.
- **Data Minimisation:** Traffic observations store aggregated, non-PII metrics. IP addresses are dropped or minimised.
