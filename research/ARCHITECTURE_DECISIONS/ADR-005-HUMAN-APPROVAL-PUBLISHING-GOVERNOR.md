# ADR-005: Human-in-the-Loop Approval & Publishing Governor

## Status
**Accepted** (13 October 2026)

## Context
The system operates autonomously to discover demand, score opportunities, and generate content. However, autonomous uncontrolled publishing poses severe brand safety, legal, and search-engine compliance risks (such as Google scaled-content abuse penalties).

We evaluated three alternatives:
1. **Fully Autonomous Publishing (Rejected):** Agents post directly to social media or web without human intervention.
2. **Post-Hoc Moderation (Audit After Publish) (Rejected):** Content is published immediately, and flagged later if problematic.
3. **Pre-Publish Human Approval Gate with 10 Deterministic Checks (Adopted):** Every asset must pass 10 deterministic quality gates to enter `approval_required`. Outbound publication physically requires an unexpired human approval event in `approval_events`.

## Decision
Enforce **Default No-Publish Mode**. Outbound publishing tasks synchronously invoke `assertPublishingApproved()`, which verifies:
1. `lifecycle_status == 'approved'`
2. An unexpired row exists in `approval_events` signed off by an authorized human operator.
3. No active kill switch is engaged for the brand, channel, or campaign.

## Consequences
- **Positive:** Guarantees 100% human oversight; protects brand reputation and prevents search engine spam penalties.
- **Tradeoff:** Workflows pause at `awaiting_approval` until an operator interacts with the Operator Control Room.
