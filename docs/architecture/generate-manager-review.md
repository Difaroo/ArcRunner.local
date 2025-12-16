# Generate Manager Redesign & Review

## Status: Analysis Phase
**Goal:** Understand current architecture, identify fragility, and propose a robust refactor plan to prevent regression.

---

## 1. Current Architecture Overview

**Core Class:** `GenerateManager` (`src/lib/generate-manager.ts`)
**Role:** Central Orchestrator for content generation tasks.

### Data Flow Pipeline
1.  **Input Reception**: Receives `GenerateTaskInput` from API Route (`api/generate/route.ts`).
2.  **Resource Integration**:
    *   **Library Resolution**: Fetches Studio Items (Characters/Locations) from DB based on `seriesId`.
    *   **Image Resolution**: Uses `resolveClipImages` to merge explicit URLs with Library items.
3.  **Model Selection & Normalization**:
    *   **Primary Source**: Explicit `input.model` (from UI Toolbar).
    *   **Secondary Source**: Episode Model (from DB).
    *   **Fallback**: `veo` (Generic).
    *   **Normalization**: Maps legacy/invalid IDs (e.g., `veo-2`, `veo-fast`, `veo`) to the internal working ID (`veo3_fast`).
4.  **Asset Preparation**:
    *   **File Upload**: Checks if reference images are local ( `/api/...`). If so, uploads them to Kie via `ensurePublicUrl` and gets a public URL.
5.  **Payload Construction**:
    *   **Logic Branching**: Separate branches for `Veo` (Video) and `Flux` (Image).
    *   **Veo Payload**: strict adherence to "CURL Spec" (`imageUrls` array, `reference_2_video` type).
    *   **Flux Payload**: `input` wrapper structure with `image_ref_urls`.
6.  **Execution**: Calls `createVeoTask` or `createFluxTask` in `src/lib/kie.ts` (which delegates to strategies).
7.  **Result Handling**:
    *   Updates DB with Task ID (Async) or Result URL (Sync).
    *   Handles errors and maps them to status strings.

---

## 2. Identified Risks & Fragility

### A. "Golden Master" vs Reality
*   **Issue**: We attempted to enforce a "clean" Golden Master (`veo-2`, camelCase params).
*   **Reality**: The backend likely relies on specific legacy configurations (`veo3_fast`, specific payload shapes like `imageUrls` array).
*   **Risk**: Future "cleanups" might inadvertently revert these working "legacy-like" configurations.
*   **Mitigation**: Explicitly document the *required* payload shape as the new standard, rather than treating it as legacy.

### B. Hardcoded Normalization
*   **Issue**: Model mapping (e.g., `if (model === 'veo-2') model = 'veo3_fast'`) is inside `startTask`.
*   **Risk**: As new models are added, this `if/else` block grows and becomes hard to maintain/test.
*   **Refactor**: Move normalization to a dedicated `ModelRegistry` or config object.

### C. Pipeline Complexity
*   **Issue**: `startTask` is a monolith. It handles DB fetching, Image Resolution, File Uploading, Payload Building, and Error Handling.
*   **Risk**: Making a change to "Upload" can break "Payload". (e.g., variable scope issues).
*   **Refactor**: Break into discrete steps/methods:
    *   `resolveContext(input)`
    *   `prepareAssets(images)`
    *   `buildPayload(context, assets)`
    *   `executeTask(payload)`

### D. Logging & Visibility
*   **Issue**: Visibility into "What images are being used?" was poor until we added ad-hoc logs.
*   **Risk**: Debugging "missing references" is difficult.
*   **Recommendation**: Standardized "Trace Object" passed through the pipeline to collect metadata for logging.

---

## 3. Proposed Refactor Plan (Phase 1)
*Do not implement yet. For review only.*

### Step 1: Modularize `GenerateManager`
Extract logic into private helper methods to clean up `startTask`.

```typescript
class GenerateManager {
  async startTask(input) {
    const context = await this.resolveContext(input);
    const modelID = this.normalizeModel(context.model);
    const publicImages = await this.uploadAssets(context.images);
    const payload = this.buildPayload(modelID, context, publicImages);
    return this.execute(payload);
  }
}
```

### Step 2: Config-Driven Model Specs
Replace `if/else` payload building with a configuration map.

```typescript
const MODEL_SPECS = {
  'veo3_fast': {
    strategy: 'veo',
    payloadType: 'FLAT_VEO',
    supportsImages: true,
    requiresArray: true
  },
  'flux-pro': {
    strategy: 'flux',
    payloadType: 'NESTED_FLUX',
    ...
  }
}
```

---

## 4. Current State (Post-Fix)
The system is currently **STABLE**.
*   **Clip 171** works.
*   **Payload** is strictly typed to the known-good CURL.
*   **Uploads** are verified.

**Recommendation**: Do NOT perform deep structural refactoring immediately effectively. Let the system run for a session to ensure stability. Future refactoring should follow the Modularization plan above.
