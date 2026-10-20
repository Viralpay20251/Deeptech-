# @omnipulse/stealth-distributor

Autonomous social media distribution service powering the **OmniPulse Engine**.
Distributes high-performing video and text assets across **5 social platforms** (YouTube Shorts, Instagram Reels, Facebook Reels, LinkedIn Video, and Twitter/X) without paid APIs, using **Patchright** stealth browser automation.

---

## Key Features

- **Zero External Paid APIs**: 100% stealth browser automation using Patchright with anti-detection fingerprinting, random human delays, and cookie-based authentication.
- **5 Platform Coverage**:
  - **YouTube Shorts**: Studio upload, title/description, audience configuration, public release, video URL extraction.
  - **Instagram Reels**: Creator upload, cover thumbnail, captioning (with hashtags), publication verification.
  - **Facebook Reels**: Creator Reels workflow, description, video publish, URL extraction.
  - **LinkedIn Video**: Native feed post, media attachment, captioning, activity tracking.
  - **Twitter / X**: Media compose, automatic thread segmentation (>280 chars with `x/N` numbering), post submission.
- **First Comment Engagement**: Automated 60-second delayed comment posted on self-authored media across all platforms to kickstart engagement algorithms.
- **Smart Scheduling & Anti-Spam Guardrails**:
  - Optimal IST posting slots (YouTube: 7am/12pm/6pm, Instagram: 8am/1pm/7pm, Facebook: 9am/3pm/8pm, LinkedIn: 8am/12pm weekdays, Twitter: 9am/2pm/9pm).
  - Strict rate limits: max 3 posts per account per day, 2-hour minimum cooldown between posts.
  - Fair round-robin account rotation among healthy accounts.
  - Auto-flags accounts as `shadowbanned` if authentication checkpoints are detected.
- **Resilient Queue Architecture**:
  - Redis media ready queues: `omnipulse:media_ready:{brand}:{platform}`
  - Dead Letter Queue with 7-day TTL: `omnipulse:dlq:{platform}`
  - `p-queue` execution limited to `concurrency: 2` for stability and stealth.
  - Metrics upserted to Supabase `distribution_metrics`.

---

## Directory Structure

```
omnipulse-engine/services/stealth-distributor/
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── main.ts                       # Main polling loop, queue orchestration, and execution
    ├── types.ts                      # Shared TypeScript interfaces & types
    ├── db/
    │   └── schema.sql                # DDL for social_accounts, content_queue, distribution_metrics
    ├── lib/
    │   ├── supabaseClient.ts         # Supabase client, queries, status updates & metrics
    │   ├── redisClient.ts            # Redis FIFO pop, DLQ with 7-day TTL, depth counters
    │   └── firstCommentPoster.ts     # 60s delayed first comment automation
    ├── scheduler/
    │   └── postScheduler.ts          # IST slot calculations, cooldowns, round-robin rotation
    ├── platforms/
    │   ├── youtubeUploader.ts        # YouTube Shorts stealth uploader
    │   ├── instagramUploader.ts      # Instagram Reels stealth uploader
    │   ├── facebookUploader.ts       # Facebook Reels stealth uploader
    │   ├── linkedinUploader.ts       # LinkedIn video stealth uploader
    │   └── twitterUploader.ts        # Twitter/X video & thread stealth uploader
    └── utils/
        └── browser.ts                # Stealth context launcher, human typing simulation, screenshot capture
```

---

## Setup & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Run with tsx
```bash
# Development (with auto-watch)
npm run dev

# Production
npm start
```

### 4. Run via Docker
```bash
docker build -t omnipulse-stealth-distributor .
docker run -d --name stealth-distributor --env-file .env omnipulse-stealth-distributor
```
