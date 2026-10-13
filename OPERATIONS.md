# Autonomous Growth OS — Operational Runbooks & Procedures

## 1. Incident Response Runbooks

### 1.1 Provider Outage or Rate Limit Spike
- **Symptom:** Tasks transition to `failed` with HTTP 429 / 503 errors from model or search connectors.
- **Automated Mitigation:** Exponential backoff with jitter pauses subsequent retries for 15 minutes.
- **Operator Action:**
  1. Inspect `apps/api/src/services/model-gateway.ts` error logs.
  2. If an AI provider is down, switch `MODEL_PROVIDER` in `.env` (e.g. from `openai` to `anthropic` or local simulator).
  3. Restart API service. In-flight tasks recover automatically via durable DAG state.

### 1.2 Unintended Content or Quality Regression
- **Symptom:** Content flagged post-approval containing inaccurate terminology or broken layout.
- **Emergency Action:**
  1. Trigger Emergency Stop via Control Room or API:
     ```bash
     curl -X POST http://localhost:3001/api/v1/kill-switches/activate \
       -H "Content-Type: application/json" \
       -d '{"scope": "brand", "scope_id": "<brand_id>", "reason": "Content quality review in progress"}'
     ```
  2. Locate asset in `content_assets` table and update status to `blocked`.
  3. If published to an OS-owned property, run retirement/rollback task.

### 1.3 Token or API Budget Exhaustion
- **Symptom:** Task fails with `BUDGET_CAP_EXCEEDED` error.
- **Rule:** The OS will never silently exceed `MODEL_BUDGET_PER_TASK_USD` ($0.50) or `MODEL_BUDGET_DAILY_USD` ($10.00).
- **Operator Action:** Review task complexity or raise budget in `.env` only after verifying efficiency.

---

## 2. Health Monitoring & Verification

```bash
# Verify API and Database health
curl http://localhost:3001/health

# Verify Pre-flight safety check
node scripts/safety-check.js
```
