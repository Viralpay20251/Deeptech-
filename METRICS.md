# Autonomous Growth OS — Metrics & Attribution Glossary

## 1. Distinct Metric Categories

The Autonomous Growth OS enforces strict separation between metric layers:
1. **Raw Impressions / Reach:** Channel-level exposure figures. Never equated to site visitors.
2. **Search Clicks / Referrals:** Observed entry events from external channels.
3. **Sessions & Engaged Sessions:** Visits with meaningful interaction ($\ge 10$ seconds or $\ge 2$ pageviews).
4. **Verified Likely-Human Traffic:** Sessions passing bot/crawler and data-center anomaly filters.
5. **Brand Meaningful Active Users (MAU):** Brand-specific qualifying events in a rolling 30-day window.
6. **Purchasing Customers (Nuty Tales):** Distinct transacting customers with verified payment. Kept strictly separate from visitors.

---

## 2. Platform-Specific MAU Definitions

| Platform | Target MAU | Qualifying Event Definition | Verification Source |
| :--- | :--- | :--- | :--- |
| **CHATR** | 100,000 | Unique user executing $\ge 1$ meaningful AI interaction or active messaging session in rolling 30 days. | Product event stream via read-only analytics. |
| **TalentXcel** | 100,000 | Unique user submitting a verified job application, tailored CV analysis, or advisory action in rolling 30 days. | Verified career tool action log. |
| **Nuty Tales** | 100,000 | Active audience: engaged catalogue/recipe views ($\ge 2$ views). **Purchasers:** Completed paid orders. | Analytics engagement + E-commerce order records. |

---

## 3. Attribution Principles

- **Association vs Causation:** We report "associated with campaign" rather than "caused by" unless verified by holdout or geo-controlled experiment.
- **Bot Traffic Separation:** Sessions classified as `likely_bot` or `known_crawler` are flagged and excluded from core growth reporting.
