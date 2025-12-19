# Project History & Architecture Log

This document serves as a rolling historical record of what was implemented, why it was implemented, and the architectural decisions behind it.

## 2025-12-18: Local Dev/Prod Isolation

### Context
We needed a way to develop new features (like Drag and Drop) without risking stability or data corruption in the "Production" version of the app that is currently in use. Since this is a single-user local application, sophisticated cloud infrastructure (VPS, Docker) was deemed unnecessary.

### Decision
We adopted a "Local Dual-Environment" strategy:
- **Development**: Runs on Port `3000`. Connects to `prisma/dev.db`.
- **Production**: Runs on Port `3001`. Connects to `prisma/prod.db`.

### Implementation Details
1.  **Database Separation**: The SQLite database was duplicated. `dev.db` is for experimentation, `prod.db` is for stable usage.
2.  **Environment Config**: Created `.env.development` and `.env.production` to automatically switch the `DATABASE_URL` based on the context.
3.  **Process Management**: 
    - `npm run dev` -> Development (Unstable)
    - `npm run start` -> Production (Stable, Port 3001)
4.  **Artifact Isolation**: Configured `next.config.js` to use `.next-dev` for Development build artifacts, preventing interference with the Production `.next` folder.

### Guardrails
- Moving features from Dev to Prod requires a build and a structured database migration (`npx prisma migrate deploy`).

---

## 2025-12-16: Generate Manager Audit & Fixes

### Context
Users reported regressions in Veo payload generation, specifically regarding `imageUrls` (array) vs `imageUrl` (singular) and deprecated model IDs (`veo3_fast`).

### Decision
A "Golden Master" audit was conducted to align the code strictly with the verified Kie.ai CURL specification.

### Implementation Details
- **Strict Typing**: Updated `src/lib/kie-types.ts` to remove permissive array types.
- **Refactor**: Removed hardcoded `veo3_fast` overrides in `src/lib/generate-manager.ts`.
- **Payload Alignment**: Enforced singular `imageUrl` for Veo-2 compatibility.
- **Reference**: [Generate Manager Review](architecture/generate-manager-review.md)

## 2025-12-16: Architecture Review - Golden Master

### Context
A broad review of the system's adherence to external API specifications.

### Findings
- Identified drift between the "Golden Master" spec (simple) and implementation (legacy complexity).
- Confirmed that `api/generate-library` was clean and compliant.
- **Reference**: [General Review](architecture/general-review.md)
