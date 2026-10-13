# ADR-001: Orchestration Runtime & Durable State Engine

## Status
**Accepted** (13 October 2026)

## Context
The Autonomous Growth OS requires a durable workflow orchestration engine to coordinate 18 specialist agents across discovery, scoring, synthesis, quality auditing, human approval, and distribution. Workflows can span minutes to days (pending human review) and must recover seamlessly across process restarts and network interruptions without executing duplicate actions or generating duplicate publications.

We evaluated three alternatives:
1. **LangGraph (State Graphs):** Python/Node.js state graph engine with persistence checkpoints.
2. **Temporal Server:** Enterprise distributed workflow orchestrator with deterministic event-sourcing replay.
3. **Database-Backed Modular DAG Engine (Adopted Initial):** Relational state machine backed by PostgreSQL (`workflow_runs`, `tasks`, `idempotency_keys`).

## Decision
Adopt an internal **Database-Backed Modular DAG Engine** for Phase 1–3, with typed schema interfaces modeled on Temporal and LangGraph contracts. For high-concurrency multi-day workflows in Phase 4+, isolate Temporal behind the identical `WorkflowOrchestrator` interface.

## Consequences
- **Positive:** Zero external server cluster dependencies (no Cassandra/Temporal server deployment required for day-one operations); complete ACID transaction safety within Supabase PostgreSQL.
- **Tradeoff:** Long-polling timer semantics are managed by lightweight database leases rather than native event-sourced replay logs.
