# Walkthrough: Nano Model Integration & Series Defaults

## Overview
Successfully integrated the **Nano Banana Pro** model into ArcRunner and implemented a hierarchical **Default Model** system at the Series level. This allows users to set a default model for an entire series (e.g., "Nano Banana Pro" or "Veo Fast"), which is automatically applied to all episodes unless overridden.

## changes

### 1. Nano Banana Model Integration
- **Payload Builder**: Created `PayloadBuilderNano.ts` to construct specific JSON payloads for the Nano API, handling text prompts and parameters like `aspect_ratio` and `resolution`.
- **Strategy Pattern**: Implemented `NanoStrategy` in `kie-strategies.ts` to handle dispatching and polling for Nano tasks, ensuring strict typing and error handling.
- **Dispatch Logic**: Refactored `generate-manager.ts` and `poll/route.ts` to use a `getStrategyType` helper, replacing brittle binary checks (`isVideo`). This makes the system extensible for future models.
- **API Updates**: Updated `kie.ts` to export `createNanoTask`.

### 2. Series Default Model Logic
- **Database Schema**: Added `defaultModel` field to the `Series` table in Prisma.
- **UI Updates**:
  - **Series Page**: Added a "Default Series Model" dropdown.
  - **Script View**: Removed the local model selector to reduce clutter and enforce the Series default.
- **Backend API**:
  - Updated `GET /api/clips` to return `defaultModel`.
  - Updated `POST /api/update_series` to allow updating the `defaultModel`.
- **Frontend Logic**:
  - Updated `page.tsx` to resolve the model using the hierarchy: `Episode Override > Series Default > Fallback ('veo-fast')`.
  - Updated Ingestion logic to respect the Series default.

## Verification
- **Dispatch**: Verified `generate-manager.ts` correctly routes Nano models to the `NanoStrategy`.
- **Inheritance**: Verified `page.tsx` `useEffect` correctly updates `selectedModel` when switching series or episodes, respecting the hierarchy.
- **API Contracts**: Verified `api/clips/route.ts` and `api/update_series/route.ts` match the updated Types definitions.

## Next Steps
- **Testing**: Physically test generating a clip with "Nano Banana Pro" selected entirely from the UI to ensure the end-to-end flow works.
- **Episode Override**: Verify that changing the model in the Episode (Main Board) dropdown persists effectively for that session.
- **Series Persistence Fix**:
  - **Refactor to Uncontrolled Component**: Replaced complex synchronization logic with standard React `defaultValue` + `key` pattern.
  - **How it works**:
    - `key={seriesId}` tells React to treat the dropdown as a *new* component whenever the Series ID changes. This forces a clean reset.
    - `defaultValue={model}` sets the initial value.
    - Because it is **Uncontrolled**, subsequent re-renders from the server (with stale data) are **ignored** by the DOM element, so the user's selection persists naturally without any lock/sync code.
    - This removed ~30 lines of complexity and aligns with standard React best practices for this scenario.
- **Library Generation Fix**:
  - **Correct Model Usage**: Updated `page.tsx` and `api/generate-library` to correctly pass the selected model (e.g., Nano) instead of defaulting to Flux.
  - **Crash Fix**: Restored missing `Textarea` and `TooltipProvider` imports in `SeriesPage.tsx` that were accidentally removed during refactoring.
- **Generation Dialog Alignment**:
  - **Unified Experience**: Updated the "Episode / Clips" generation flow to use a confirmation dialog that matches the "Studio" style.
  - **Read-Only Model Display**: Added the selected Model (e.g., "Nano Banana Pro") to both dialogs as a read-only field in the info grid, ensuring users know exactly what they are generating with.
  - **No Dropdown**: As requested, kept the dialog simple without a model selector dropdown.
- **API/DB Sync Fix**:
  - **Prisma Client Regenerated**: Solved `Unknown argument defaultModel` error by running `npx prisma generate`. The database schema was correct, but the client library used by the API was stale.
