# Autonomous Growth OS
> **Deep-Tech, AI-Agentic, Cross-Channel Traffic Acquisition and Marketing Platform**

[![Safety Verification](https://img.shields.io/badge/Safety_Boundary-Enforced-success.svg)](#non-negotiable-boundaries)
[![Platform Independence](https://img.shields.io/badge/Production_Separation-Absolute-blue.svg)](#project-separation)
[![Autonomy Gate](https://img.shields.io/badge/Publishing_Mode-Approval_Required-amber.svg)](#human-approval-gate)

---

## 1. Executive Overview

The **Autonomous Growth OS** is an independent, deep-tech audience acquisition engine designed to prove repeatable, legitimate traffic acquisition and meaningful growth for three distinct proving-ground platforms before being commercialised as an independent SaaS technology:

1. **CHATR** — AI, communication, productivity, and user experiences (Target: 100,000 MAU).
2. **TalentXcel** — Career tools, recruitment, and professional advancement (Target: 100,000 MAU).
3. **Nuty Tales** — Commerce, dry fruits & nuts, artisanal gifting, and wholesale (Target: 100,000 MAU; active audience and actual purchasing customers reported strictly separately).

### Core Operating Loop
```
Discover Demand ──► Understand Intent ──► Gather Evidence ──► Select Opportunity
       ▲                                                              │
       │                                                              ▼
Prioritise Next ◄── Learn & Adapt ◄── Measure Outcomes ◄── Attribute ◄── Distribute ◄── Validate QA (10 Gates) ◄── Create Value
```

---

## 2. Non-Negotiable Boundaries

- **Total Project Separation:** The Autonomous Growth OS is completely separate from CHATR, TalentXcel, and Nuty Tales. It never modifies existing repositories, production databases, production DNS, SEO settings, or deployment configs.
- **Strict Brand Protection:** Every internal brand is configured with `is_protected_production = TRUE`. Automatic write actions to protected infrastructure are physically blocked.
- **Truth in Measurement:** Zero fake traffic, bot clicks, engagement pods, or fabricated metrics. Missing credentials report truthfully as `baseline not established`.
- **Default No-Publish Mode:** No asset or campaign may be published without an explicit, non-expired human approval event (`approval_events`).
- **Commercialisation Gated:** External SaaS tenant onboarding remains disabled behind feature flags and owner approval until Proof Gates A–F have passed.

---

## 3. Repository Structure

```
autonomous-growth-os/
├── apps/
│   ├── api/                    # Express + TypeScript Control Plane & Worker Engine
│   │   ├── src/
│   │   │   ├── agents/         # 18 Specialist Agent contracts
│   │   │   ├── connectors/     # Connector adapters (Sitemap/RSS, GSC, GA4, LinkedIn, etc.)
│   │   │   ├── db/             # Migrations & development seeds
│   │   │   ├── lib/            # Safety boundaries, Pino logger, DB pool, env loader
│   │   │   ├── routes/         # REST API endpoints (brands, demand, workflows, approvals, kill-switches)
│   │   │   └── services/       # Orchestrator, Scoring Engine, Quality Governor, Model Gateway
│   │   └── package.json
│   └── web/                    # React + TypeScript Operator Control Room
│       ├── src/
│       │   ├── App.tsx         # Central operator dashboard & approval console
│       │   └── main.tsx
│       └── package.json
├── packages/
│   ├── shared-types/           # Shared TypeScript domain contracts & safety types
│   └── config/                 # Shared configuration helpers
├── tests/
│   ├── unit/                   # Unit tests (scoring model, quality governor)
│   ├── integration/            # Workflow DAG vertical slice tests
│   └── security/               # SSRF, prompt injection, and approval gate tests
├── scripts/
│   └── safety-check.js         # Pre-flight CI safety verification script
├── docs/                       # Architecture, security, connector, and operations runbooks
├── .env.example                # Variable names only — zero hard-coded secrets
├── package.json                # Root npm workspaces manifest
└── tsconfig.base.json          # Strict TypeScript base configuration
```

---

## 4. Quickstart & Local Development

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL >= 15 (optional for test suites, which run with in-memory isolation)

### Installation
```bash
# 1. Clone repository (independent directory)
cd autonomous-growth-os

# 2. Run safety check
node scripts/safety-check.js

# 3. Install dependencies
npm install

# 4. Copy environment template
cp .env.example .env
```

### Running Tests
```bash
# Run all unit, security, and integration tests
npm test
```

### Starting the Control Plane & Web Console
```bash
# Start API (port 3001)
npm run dev

# Start Operator Web Console (port 3000)
npm run dev:web
```

---

## 5. Documentation Directory

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System architecture, DAG orchestrator, and service boundaries.
- [`SECURITY.md`](./SECURITY.md) — Threat model, SSRF defense, prompt injection mitigations, and emergency kill switches.
- [`CONNECTORS.md`](./CONNECTORS.md) — Connector catalogue, capability matrices, and OAuth scopes.
- [`AGENTS.md`](./AGENTS.md) — 18 specialist agent contracts, autonomy levels, and tool allocations.
- [`OPERATIONS.md`](./OPERATIONS.md) — Operational runbooks, incident response, and emergency procedures.
- [`DATA_GOVERNANCE.md`](./DATA_GOVERNANCE.md) — Data retention, provenance, and tenant isolation policies.
- [`METRICS.md`](./METRICS.md) — Distinct MAU definitions, attribution models, and conversion rules.
- [`ROADMAP.md`](./ROADMAP.md) — Implementation phase status and proof gate criteria.
