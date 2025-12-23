# Project History & Architecture Log

This document serves as a rolling historical record of what was implemented, why it was implemented, and the architectural decisions behind it.

## 2025-12-20: v0.7.2 - Reactive Studio & Agent Foundations

### Context
Addressed user feedback regarding the "Studio" (Library) reactivity. Previously, updating a character/location image didn't immediately reflect in the Clips table. Also laying groundwork for Agentic testing.

### Changes
- **Studio Reactivity**: Implemented "Beacon" logging and improved `resolveClipImages` logic to ensure clip thumbnails update instantly when their linked Studio Asset is modified.
- **Agent Test Migration**: Added `AgentMigrationTest` table (via Prisma) to validate migration workflows.
- **Version Bump**: 0.7.1 -> 0.7.2.

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

## 2025-12-21: v0.7.3 - New Series Process Hardening

### Context
Addressed critical robustness issues in the "New Series" creation flow. Previously, network errors or duplicate names would cause the dialog to close immediately, resulting in data loss and confusing user experience.

### Changes
- **Robustness**: Implemented strict validation and proper HTTP error codes (409 Conflict) for duplicate series names.
- **Async Handling**: Updated the parent-child component communication to be fully async, allowing the UI to wait for server confirmation.
- **UI Polish**: Added loading states (spinners) and inline error messages (no more alerts). Also refined the Add Series dialog spacing to match the design system.
- **Version Bump**: 0.7.3 -> 0.8.0.

## 2025-12-23: v0.8.0 - Feature Pack: Duplication, Fast Delete, & UI Polish

### Context
This major release focuses on workflow velocity and visual refinement. Users needed faster ways to build scenes (duplication) and a more responsive deletion experience. We also performed a comprehensive "Style & Stability" pass to fix long-standing UI quirks.

### Features
- **Duplicate Support**:
    - **Clips**: Added "Duplicate" (+) action with smart scene incrementing (`1.1` -> `1.2`) and "Midpoint" sorting.
    - **Library**: Added duplication for Characters/Locations to speed up asset creation.
- **New Asset Workflows**:
    - **New Scene**: Added top-level "Add" button for quick scene creation.
    - **New Studio Item**: Added "New Item" button to the Library view.
- **Tombstone Deletion**:
    - Implemented client-side "Tombstones" for instant visual removal of deleted items.

### UI & Architecture Refinements
- **Global Z-Index Hardening**: Lifted `PageHeader` and `RowActions` (`z-50`) to prevent overlay blocking.
- **Button System Upgrade**:
    - Migrated global color variables to **HSL** to fix opacity bugs.
    - Standardized all `outline` buttons to use `border-black` for visibility.
- **Location Menu Fix**: Replaced custom autocomplete with a robust **Dropdown Button**.
- **Environment Findings**: Confirmed "Hover" issues on M4 Macs are browser-level behavior.

## 2025-12-23: v0.8.1 - UI Polish & Renumbering

### Context
A refine-and-polish release following v0.8.0, focusing on Action Toolbar usability and interface consistency.

### Changes
- **Smart Renumbering**: Added "Location-Sensitive" renumbering to the Action Toolbar.
    - Increments Scene (1.01 -> 2.01) when Location changes.
    - Includes `Loader2` spinner state.
    - Updated backend API (`/api/renumber`) to handle UUIDs/Integers robustly.
- **Batch Dialog**: Added confirmation step and "singular/plural" grammar logic for model generation.
- **Action Toolbar Layout**:
    - Standardization: Strict 16px (`gap-4`) spacing.
    - Dividers: Removed uneven margins for perfect symmetry.
- **Visual Polish**:
    - Updated Page Header titles to "Grey / White" hierarchy.
    - Restored material icons for Generate button.
- **Version Bump**: 0.8.0 -> 0.8.1.
