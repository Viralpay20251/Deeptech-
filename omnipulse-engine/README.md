# OmniPulse Engine

> **Zero-Cost Autonomous Multi-Platform Social Distribution & Programmatic SEO (pSEO) Operating System**

OmniPulse Engine is an autonomous growth infrastructure designed to achieve **50,000+ daily views per brand across 5 major social networks** (YouTube, TikTok, Instagram, Twitter/X, and LinkedIn) and power **10M–560M deterministic programmatic SEO pages** without external paid API subscriptions or relational database row bloat.

---

## 🏛️ System Architecture

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                              OPERATOR CONTROL PLANE                               │
│        Vite + React Command Dashboard (/omnipulse, /accounts, /queue, /pseo)      │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │ HTTP / REST / Webhook
┌────────────────────────────────────────▼──────────────────────────────────────────┐
│                             AUTONOMOUS GROWTH CORE                                │
│                                                                                   │
│  ┌─────────────────────────┐                 ┌─────────────────────────────────┐  │
│  │   Tenant Provisioner    │◄──Webhooks──────┤      Supabase PostgreSQL        │  │
│  │       (Port 3002)       │                 │   - registered_domains          │  │
│  │  - Cloudflare Hostnames │                 │   - pseo_dimension_catalog      │  │
│  │  - Google Verification  │──State Update──►│   - distribution_metrics        │  │
│  │  - GSC Sitemap Submit   │                 │   - social_accounts / queue     │  │
│  └───────────┬─────────────┘                 └────────────────┬────────────────┘  │
│              │                                                │                   │
│              ▼                                                ▼                   │
│  ┌─────────────────────────┐                 ┌─────────────────────────────────┐  │
│  │  Edge-TTS Synthesizer   │                 │    SearXNG Discovery Engine     │  │
│  │       (Port 5050)       │                 │           (Port 8080)           │  │
│  │ Neural Voice Synthesis  │                 │ Google, Bing, Reddit, YT Scrap  │  │
│  └───────────┬─────────────┘                 └────────────────┬────────────────┘  │
│              │                                                │                   │
│              ▼                                                ▼                   │
│  ┌─────────────────────────┐                 ┌─────────────────────────────────┐  │
│  │   Ollama Local Engine   │                 │      Patchright CDP Daemon      │  │
│  │      (Port 11434)       │                 │           (Port 9222)           │  │
│  │   llama3.2:3b / qwen    │                 │ Anti-Detect Browser Automation  │  │
│  │ Zero-Token Local Model  │                 │ Headless Posting & Auth Cookies │  │
│  └─────────────────────────┘                 └─────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### 1. Environment Configuration
Copy `.env.example` to `.env` and fill in your Supabase, Cloudflare, and Google credentials:
```bash
cp .env.example .env
```

### 2. Pull the Local AI Model
Boot Ollama and download the local 3B model (runs locally on CPU or GPU with 0 token spend):
```bash
docker compose up -d ollama
docker compose exec ollama ollama pull llama3.2:3b
```

### 3. Start All Engine Services
Start the full local microservice stack:
```bash
docker compose up -d
```

### 4. Apply Database Migrations
Copy the SQL migration scripts from `apps/api/src/db/migrations/` into the Supabase SQL editor or run them via the CLI:
```bash
npm run db:migrate
```

### 5. Configure DNS Records
Add wildcard CNAME or A records for each brand pointing your custom subdomains to your origin ingress server:
```text
*.talentxcel.com   CNAME   origin.growth-os.internal
*.chatr.chat       CNAME   origin.growth-os.internal
*.nutytales.com    CNAME   origin.growth-os.internal
*.txacademy.ai     CNAME   origin.growth-os.internal
```

### 6. Configure Cloudflare Custom Hostnames
Ensure your Cloudflare account has Custom Hostnames (SSL for SaaS) enabled under your primary zones. The Tenant Provisioner service automatically adds hostnames, provisions SSL certificates, verifies DNS ownership, and submits sitemaps to Google Search Console.

---

## 📦 Service Matrix & Data Flow

| Service | Port | Primary Function | Data Flow |
| :--- | :--- | :--- | :--- |
| **Tenant Provisioner** | `3002` | Automated domain onboarding, Cloudflare SSL, GSC site verification | Listens for Supabase webhooks on `/webhook/domain-added`; drives Cloudflare API and Google Webmasters v3. |
| **Ollama Local Engine** | `11434` | Scriptwriting, hook generation, metadata synthesis, topic analysis | Receives prompts from queue workers; streams structured JSON completions locally without external APIs. |
| **SearXNG Search Aggregator** | `8080` | Privacy-preserving multi-engine web trend scraping | Queries Google, Bing, DuckDuckGo, Reddit, YouTube without API keys; feeds trend signals to demand clusters. |
| **Patchright CDP Browser** | `9222` | Stealth browser automation and social media publisher | Controls Chromium via DevTools Protocol; simulates human typing, cookies, and headless video uploads. |
| **Edge-TTS Audio Engine** | `5050` | Zero-cost neural text-to-speech voice generation | Converts generated voiceover scripts to high-definition MP3 audio files using Microsoft Edge Neural voices. |
| **Supabase PostgreSQL** | `5432` | Authoritative persistence, state machines, and metric ledgers | Stores domain registries, approval queues, social account health, and execution telemetry. |

---

## 🍪 Social Account Setup Guide (Patchright Cookies)

OmniPulse uses anti-detect headless browser sessions with persisted authentication state to avoid expensive or restricted developer APIs.

### How to Save Sessions for Each Social Network

1. **Launch Patchright Interactive Session Recorder:**
   ```bash
   npx tsx scripts/record-social-session.ts --platform=<platform> --brand=<brand_slug>
   ```
   *(Supported platforms: `youtube`, `tiktok`, `instagram`, `twitter`, `linkedin`)*

2. **Authenticate Interactively:**
   - A Chromium window with randomized canvas, WebGL, and user-agent fingerprints opens.
   - Log in to your brand account manually and solve 2FA if required.

3. **Automatic Cookie State Extraction:**
   - The session script serializes your session tokens and storage state into:
     ```text
     omnipulse-engine/storage/sessions/{brand_slug}/{platform}_session.json
     ```
   - The `social_accounts` record is updated with `cookie_status: 'valid'` and `health_status: 'healthy'`.

4. **Autonomous Rotation & Heartbeat:**
   - Patchright performs a daily passive request (such as checking notification counts) to keep the cookie session fresh without triggering bot detection heuristics.

---

## 📈 Programmatic SEO & Dimension Routing Architecture

Traditional SEO systems create database rows for every landing page, which collapses when scaling to hundreds of millions of combinations.

OmniPulse uses **Deterministic Combinatorial URL Routing**:
- Dimensions are modeled as compact lookup arrays (Roles: 4,200, Locations: 1,800, Tools: 850, Templates: 1,500).
- URLs follow deterministic patterns:
  ```text
  https://jobs.talentxcel.com/{role}-jobs-in-{location}
  https://salaries.talentxcel.com/{role}-salary-with-{tool}
  https://templates.chatr.chat/{template}-for-{use_case}
  https://recipes.nutytales.com/{ingredient}-activated-{benefit}
  ```
- **Storage cost: 0 bytes per page.** Pages are synthesized on-demand with Edge SSR and cached in Cloudflare CDN cache tier.
- Sitemaps are partitioned into deterministic 50,000-URL shards: `sitemap_1.xml`, `sitemap_2.xml` under `sitemap_index.xml`.

---

## ⚙️ Scaling Guidelines

### Adding More Subdomains
1. Insert new hostnames into `registered_domains`:
   ```sql
   INSERT INTO registered_domains (workspace_id, brand_id, hostname, host_role, indexing_intent)
   VALUES ('00000000-0000-0000-0000-000000000001', 'brand-uuid', 'newsub.chatr.chat', 'product_subdomain', 'indexable');
   ```
2. The Tenant Provisioner webhook fires automatically, mounts the Cloudflare Custom Hostname, registers DNS TXT verification, and submits `https://newsub.chatr.chat/sitemap_index.xml` to GSC.
3. Maximum custom hostnames on Cloudflare Free Tier: **100 custom hostnames**.

### Scaling Social Accounts
- OmniPulse enforces strict daily volume caps per account (3–5 posts/day) to keep accounts in algorithmic good standing.
- If an account is flagged as `shadowbanned` or `restricted`, the engine automatically activates a 48-hour cooldown and reallocates distribution traffic to auxiliary accounts.
