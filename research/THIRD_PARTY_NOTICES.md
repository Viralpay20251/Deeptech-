# Autonomous Growth OS — Third-Party Notices & Dependency SBOM

**Snapshot Date:** 13 October 2026  
**Auditor:** Principal Software Architect  
**Specification Reference:** Master Build Prompt Section 26.2  

---

## 1. Direct Dependency Software Bill of Materials (SBOM)

All direct dependencies installed in the Autonomous Growth OS codebase have been audited for commercial SaaS compatibility. Zero copyleft (`GPL`, `AGPL`) or non-OSI (`BSL`, `SSPL`) dependencies are present in runtime bundles.

| Package | Version | Declared Licence | SPDX Identifier | Commercial SaaS Compatibility |
| :--- | :--- | :--- | :--- | :--- |
| `express` | `^4.21.1` | MIT | `MIT` | Fully Permissive |
| `pg` | `^8.12.0` | MIT | `MIT` | Fully Permissive |
| `zod` | `^3.23.8` | MIT | `MIT` | Fully Permissive |
| `pino` | `^9.4.0` | MIT | `MIT` | Fully Permissive |
| `helmet` | `^8.0.0` | MIT | `MIT` | Fully Permissive |
| `cors` | `^2.8.5` | MIT | `MIT` | Fully Permissive |
| `compression` | `^1.7.4` | MIT | `MIT` | Fully Permissive |
| `express-rate-limit` | `^7.4.0` | MIT | `MIT` | Fully Permissive |
| `axios` | `^1.7.7` | MIT | `MIT` | Fully Permissive |
| `uuid` | `^10.0.0` | MIT | `MIT` | Fully Permissive |
| `jsonwebtoken` | `^9.0.2` | MIT | `MIT` | Fully Permissive |
| `bcryptjs` | `^2.4.3` | MIT | `MIT` | Fully Permissive |
| `xml2js` | `^0.6.2` | MIT | `MIT` | Fully Permissive |
| `node-html-parser` | `^6.1.13` | MIT | `MIT` | Fully Permissive |
| `sanitize-html` | `^2.13.1` | MIT | `MIT` | Fully Permissive |
| `robots-parser` | `^3.0.1` | MIT | `MIT` | Fully Permissive |
| `dotenv` | `^16.4.5` | MIT | `MIT` | Fully Permissive |
| `openai` | `^4.67.0` | Apache-2.0 | `Apache-2.0` | Fully Permissive |
| `@anthropic-ai/sdk` | `^0.30.1` | MIT | `MIT` | Fully Permissive |
| `react` | `^18.3.1` | MIT | `MIT` | Fully Permissive |
| `react-dom` | `^18.3.1` | MIT | `MIT` | Fully Permissive |

---

## 2. Prohibited Dependency Register

The following packages are blacklisted by automated linting and pre-flight checks:
- Any package licensed under `AGPL-1.0`, `AGPL-3.0`, `GPL-1.0`, `GPL-2.0`, `GPL-3.0`
- Any package with `Fair-Code`, `BSL-1.1`, `SSPL-1.0`, or `Elastic-2.0` unless isolated in an external microservice with written owner sign-off.
- Any package attempting network scraping of search engines or bypassing access controls.
