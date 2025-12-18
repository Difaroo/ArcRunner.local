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

### Guardrails
- Moving features from Dev to Prod requires a build and a structured database migration (`npx prisma migrate deploy`).
