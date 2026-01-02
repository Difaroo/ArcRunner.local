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

## 3. Target Architecture: The "Payload Builder" Pattern

To resolve complexity and fragility, we will refactor the system into a modular "Delegation" architecture.

### A. Core Components

1.  **`GenerateManager` (Changes):**
    *   No longer builds JSON.
    *   No longer normalizes model IDs inside `startTask`.
    *   **Role**: Resolves Inputs -> Selects Builder (via Factory) -> Uploads Assets -> Executes Task.

2.  **`PayloadBuilder` (Interface):**
    ```typescript
    interface PayloadBuilder {
      build(context: GenerationContext): Promise<any>;
      supports(modelId: string): boolean;
      validate(context: GenerationContext): string[]; // Returns errors
    }
    ```

3.  **Concrete Builders (Extraction):**
    *   **`VeoPayloadBuilder`**:
        *   Encapsulates `veo3_fast` logic (verified).
        *   Handles `REFERENCE_2_VIDEO` vs `TEXT_2_VIDEO`.
        *   Enforces `imageUrls` (Array) syntax.
    *   **`FluxPayloadBuilder`**:
        *   Encapsulates `flux-kontext-pro` logic (official).
        *   Handles `inputImage` (Singular) syntax.

4.  **`BuilderFactory` (Registry):**
    *   Maps Model IDs (`veo3_fast`, `veo-2` legacy) to specific Builders.
    *   Central place to add new models (e.g. `sora-1`).

### B. Extensibility Strategy (Safe Growth)
To add a new model (e.g., Sora):
1.  Create `SoraPayloadBuilder.ts`.
2.  Register it in `BuilderFactory`.
3.  **Zero risk** to existing Veo/Flux logic.

### C. Refactor Strategy: "Safe Extraction"
1.  **Duplicate**: Copy exact working code from Manager to Builder.
2.  **Verify**: Run Manager and Builder side-by-side on test inputs. Assert `JSON.stringify(old) === JSON.stringify(new)`.
3.  **Switch**: Point Manager to use Builder.


---

## 4. Current State (Post-Fix)
The system is currently **STABLE**.
*   **Clip 171** works.
*   **Payload** is strictly typed to the known-good CURL.
*   **Uploads** are verified.

**Recommendation**: Do NOT perform deep structural refactoring immediately effectively. Let the system run for a session to ensure stability. Future refactoring should follow the Modularization plan above.
