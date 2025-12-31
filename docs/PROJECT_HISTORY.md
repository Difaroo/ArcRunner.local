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

## 2025-12-24: v0.9.0 - Series Page Overhaul

### Context
A significant UX overhaul for the Series Page to streamline episode management and improve visual consistency. Users needed faster ways to create, rename, and edit episodes without navigating away from the list view.

### Features
- **Series Renaming**:
    - Added inline editing to the Series Page header.
    - Hover-to-edit pencil icon with Save/Cancel controls.
- **New Episode Workflow**:
    - Introduced a dedicated "NEW EPISODE" button in the header.
    - Implemented a modal dialog for creating episodes with Title and Number.
- **Inline Episode Editing**:
    - Clicking an episode number now activates "Row Edit Mode".
    - Allows direct modification of Title and Episode Number.
    - Replaced text buttons with square, outlined Icon Buttons (Check/X) using `outline-success` and `outline-destructive` variants for consistency.

### UI Refinements
- **Header Standardization**: Renamed "Series" to "Episodes" in the page header.
- **Table Styling**: Updated table headers to standard uppercase/stone style.
- **Visual Cleanup**: Removed redundant side panel titles and unified background colors.
- **Version Bump**: 0.8.1 -> 0.9.0.

## 2025-12-24: Storyboard & Frontend Architecture Review

### Context
Implemented the Storyboard view to provide a visual timeline of scenes. Following this, a focused architectural review of the frontend was conducted to identify technical debt and future refactoring needs.

### Features (Storyboard)
- **Visual Grid**: 4-column layout for scene visualization.
- **Print Optimization**: Global styles to strip UI chrome for clean PDF exports.
- **Visibility Toggle**: "Soft hide" for clips (greyed out in UI, hidden in Print).

### Architectural Review Findings
A deep-dive into the stack structure revealed specific areas for improvement:
- **Monolith Component**: `page.tsx` (>1600 lines) needs splitting into View components.
- **State Management**: Complex `useState` trees should move to Zustand or Context.

### Print Layout Refinements
- **Native Browser Control**: Removed custom "Table Hacks" to allow cleaner browser margin management.
- **Dual Layout Modes**:
    - **Landscape**: Standard 3x2 Grid for high-fidelity thumbnails.
    - **Portrait**: Specialized "Row Layout" (Image | Scene | Action | Dialog) for high-density lists (6 per page).
- **Screen Decoupling**: Ensured changing Print Layout settings does not break the on-screen UI.
- **Precision Margins**: Fine-tuned to 14mm Top, 9mm Sides, 0 Bottom with specific header spacing.
- **State Management**: Current `useAppStore` hook causes excessive re-renders; recommendation to move to Zustand.
- **Type Definitions**: Shared types (`Clip`, `Series`) are currently co-located in API routes, creating circular dependencies.

### Reference
- [Full Stack Review & Recommendations](architecture/full_stack_review_and_recommendations.md)

## 2025-12-26: v0.10.0 - Storyboard v1 & Universal Media Preview

### Context
This milestone release introduces the **Storyboard View** for visual storytelling and significantly upgrades the media handling architecture. It also solidifies the Print Workflow to support professional PDF exports.

### Features
- **Storyboard View**:
    - A dedicated visual timeline for managing scenes.
    - **Print Layout Engine**: Robust "Portrait 6x1" and "Landscape 3x2" modes with precision 14mm/9mm margins.
    - **Visibility Controls**: Soft-hide clips from print without deleting them.
- **Universal Media Preview**:
    - **Smart Modals**: Centralized standard for viewing media. clicking a thumbnail now opens a high-fidelity Modal (Player for Video, Lightbox for Image).
    - **Content Awareness**: The UI correctly identifies Video vs Image content even when displaying a fallback thumbnail.
- **Backend Robustness**:
    - **Defensive Thumbnailing**: Integrated `generateThumbnail` directly into the polling loop to ensure no "Missing Thumbnail" states occur after jobs complete.
    - **Safe-Fail Logic**: Processing errors are logged but do not block result URL saving.

### Architecture
- **Refactor**: Decoupled `MediaDisplay` from ad-hoc `window.open` calls to a self-contained component using `MediaPreviewModal`.
- **Docs**: Updated [Walkthrough](walkthrough.md) and [Full Stack Review](architecture/full_stack_review_and_recommendations.md).
- **Version Bump**: 0.9.0 -> 0.10.0.

## 2025-12-30: v0.11.0 - Flux Generation & Environment Hardening

### Context
Completed a major epic to integrate the "Flux" image generation model into the Studio library workflow, prioritizing high-quality "cinematic" output and smart style referencing. During this process, we identified and resolved critical environmental instabilities caused by ghost server processes.

### Features
- **Flux Model Integration**:
    - **Smart Model Selection**: Automatically switches between `flex-text-to-image` and `flex-image-to-image` based on input availability.
    - **Style Injection**: Automatically resolves and injects "Style" descriptions and reference images into the prompt pipeline.
    - **Local Persistence**: Full-resolution images are now downloaded and stored locally (`public/media/library`) to prevent link expiry.
- **Library UI Improvements**:
    - **Status Alignment**: Moved generation status/error text to the "Row Actions" column (beneath buttons) to match the Clip table layout.
    - **Input Sanitization**: Implemented "Nuclear" protection to prevent error dumps/debug text from rendering in the image input field.

### Environmental Hardening (DevOps)
- **Anti-Ghosting**: `npm run dev` now automatically kills any process on Port 3000 before starting.
- **Auto-Sync**: `npm run dev` now automatically runs `npx prisma generate` to prevent database schema mismatches.
- **Logging Hygiene**: Enforced strict `no-console` linting rules to keep production logs clean.

### Version Bump
- **Core**: 0.10.0 -> 0.11.0.

## 2025-12-31: v0.12.0 - Persistence & Robustness

### Context
A critical robustness release addressing regression in "Broken Icons" and Studio State Persistence. Also finalized the "Flux" optimization with tuned parameters for high-fidelity generation.

### Changes
- **Downloads Architecture**:
    - **Proxy Stream**: Replaced Blob downloading with a direct `Content-Disposition` stream to prevent OOM on large files.
    - **Security**: Added strict filename sanitization on both client and server proxies.
- **Persistence & State**:
    - **Race Condition Fix**: Solved a critical bug where Studio settings (Seed, Style, Guidance) reset on page load.
    - **Local State**: Now correctly persists `seed`, `currentEpisode`, and `currentSeriesId` to `localStorage`.
- **Flux Optimization**:
    - **Guidance Tuning**: Mapped UI (1-10) to API (1.5-10.0) for full control range.
    - **Prompt Engineering**: Added specific "Style Reference" weights `(text:1.3)` to the Flux payload.
    - **Bug Fixes**: Whitelisted `/media/` paths to fix broken previews for locally generated images.
- **Version Bump**: 0.11.0 -> 0.12.0.

## 2025-12-31: v0.12.1 - UI Polish & Hotfixes

### Context
A follow-up patch to v0.12.0 addressing visual regressions in the Studio Edit mode and refining the Media Preview experience.

### Changes
- **Bug Fixes**:
    - **Edit Mode Thumbnails**: Whitelisted `/media/` paths in `ImageUploadCell` to correctly display locally persisted images during editing (previously showed "Err").
- **UI Refinements**:
    - **Preview Modal**: Removed duplicate "Close" (X) icon caused by default Dialog behavior.
    - **Styling**: Standardized Preview Modal buttons (Download/Close) to uniform size and Orange branding for better visibility.
- **Version Bump**: 0.12.0 -> 0.12.1.

## 2025-12-31: v0.12.2 - Database Synchronization

### Context
This patch resolves a schema drift issue encountered after migrating the Production database to the Development environment. The older Production database lacked the `thumbnailPath` column in the `StudioItem` table, causing application crashes.

### Changes
- **Database**: 
    - Migrated Production data to Development environment (`prod.db` -> `dev.db`).
    - Forced schema synchronization (`prisma db push`) to add the missing `thumbnailPath` column.
    - Cleared stale database locks caused by zombie processes.
- **Version Bump**: 0.12.1 -> 0.12.2.
