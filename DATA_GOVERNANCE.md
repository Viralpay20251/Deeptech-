# Autonomous Growth OS — Data Governance & Provenance Policy

## 1. Principles of Data Integrity

1. **Strict Provenance:** Every demand signal, claim, and observation carries `source_type`, `source_url`, `observed_at`, and `ingested_at` timestamps.
2. **Zero Mixed Demo Data:** Test and demo records must carry `is_demo_data = TRUE`. Production queries strictly filter `WHERE is_demo_data = FALSE`.
3. **Tenant & Brand Isolation:** Every record is scoped to `workspace_id`. Cross-tenant data sharing is prohibited.
4. **Data Minimisation:** No consumer PII is captured or stored. Personal contact databases are never scraped.

---

## 2. Retention Schedules

| Entity | Retention Period | Rationale |
| :--- | :--- | :--- |
| `audit_events` | 7 Years (Immutable) | Regulatory compliance and change traceability. Never truncated. |
| `kill_switch_events` | 7 Years | Security incident audit history. |
| `raw_signal` / `source_observations` | 90 Days | Sufficient for trend clustering; minimises storage bloat. |
| `traffic_observations` (Aggregated) | 24 Months | Required for multi-year seasonality and cohort retention analysis. |
| `model_cost_records` | 36 Months | Financial audit and token cost efficiency tracking. |
