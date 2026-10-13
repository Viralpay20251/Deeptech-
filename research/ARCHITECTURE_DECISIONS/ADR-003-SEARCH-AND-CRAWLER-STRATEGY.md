# ADR-003: Public Search Discovery & Crawler Strategy

## Status
**Accepted** (13 October 2026)

## Context
The OS requires public demand discovery to detect search queries, trending topics, and content gaps across authorized sites and public sitemaps.

We evaluated three alternatives:
1. **Lightweight TypeScript Web Inspector (Adopted):** Built-in Node.js fetcher with strict SSRF validation, `robots.txt` compliance, and stream XML parsing.
2. **Scrapy (Python Framework):** Mature batch web crawler.
3. **Headless Browser Scraping (Playwright / Puppeteer):** Rendering JavaScript for every crawled page.

## Decision
Adopt a **Lightweight TypeScript Web Inspector** with synchronous SSRF protection and token bucket rate limits. Full headless browser automation is restricted to authorized UI verification and QA only.

## Consequences
- **Positive:** High performance, low resource consumption, zero headless browser memory leaks; total immunity to SSRF attacks targeting cloud metadata (`169.254.169.254`).
- **Tradeoff:** Does not execute client-side JavaScript on single-page apps; public search discovery relies on sitemaps, RSS feeds, and official search APIs.
