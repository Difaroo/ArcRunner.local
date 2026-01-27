# ArcRunner Render Engine Architecture (v0.25.1)

## Architecture Overview
The ArcRunner Render Engine is a high-availability polling infrastructure designed to bridge the gap between a stateful React UI and the asynchronous Kie.ai Generation API. It prioritizes **Data Integrity**, **Self-Healing**, and **User Visibility**.

### Core Flow
1.  **Trigger**: User initiates generation via UI (Episode or Studio).
2.  **Payload Construction**: The `GenerateManager` selects the appropriate Strategy (`Flux`, `Veo`, `Nano`, `Kling`) based on inputs.
    *   **Start Frame Intelligence (Image Models Only)**: If active (and model is Nano/Flux), the system truncates the Action to the first sentence and *filters* character metadata to only include those explicitly named in that sentence. Video models bypass this to preserve full temporal context.
3.  **Submission**: A `POST` request is sent to Kie.ai.
4.  **Task Tracking**: The Task ID (`taskId`) and initial inputs are persisted immediately to the Database (`Clip` or `StudioItem`).
5.  **Polling Loop**: The frontend `usePolling` hook (or centralized Polling Service) queries the status of active tasks.
6.  **Resolution**: Upon completion (`Done`), the result URL is secured (downloaded/proxied) and the DB is updated.

## Key Components

### 1. Payload Builders (`src/lib/builders/*`)
Each model family has a dedicated builder ensuring strict adherence to API schemas.
-   **Flux**: Handles Style Injection, Strength mapping (UI 1-10 -> API 1.5-10.0), and Aspect Ratio.
-   **Veo**: Manages complex `IMAGE_TO_VIDEO` (S2E), `TEXT_2_VIDEO`, and `REFERENCE_2_VIDEO` tasks with automatic fallback logic.
-   **Kling (Minimalist Schema)**: 
    -   **Strategy**: Uses a dedicated `KlingSchema` that STRIPS all Character and Location text descriptions.
    -   **Rational**: Relies 100% on Reference Images for visual consistency, using text only for `Action` and `Camera` instructions. This resolves token limits and preventing conflicts.
    -   **Path Resolution**: `GenerateManager` now correctly maps local `/media/clips/` paths to physical files for upload.
-   **Nano**: Specialized builder for banana-pro pipelines.

### 2. Polling Infrastructure (`src/app/api/poll/route.ts`)
The heartbeat of the engine.
-   **Zombie Killer**: Automatically marks tasks as `Error` if they remain in "Generating" state without a valid remote ID for > 45s (upload timeout).
-   **Smart Merge (v0.16.2)**: Intelligently merges polling results with local optimistic state to prevent UI flicker.
-   **Result Ordering**: Ensures the newest result is always prepended to the CSV list.
-   **Unified Route**: `api/generate` now handles all models, ensuring consistent features (like Start Frame logic) across Flux, Nano, and Video models.

### 5. Persistence Model (Phase 3 Migration Protection)
Since the system is in a "Dual-Write / Kill-Switch" phase where legacy columns may not be perfectly synced:
-   **Authoritative Response**: The `api/update_clip` route returns the *intended* state of reference columns based on `MediaService` transactions, rather than blindly returning potentially stale DB columns. This prevents "Zombie Images" on the frontend.

### 3. Data Integrity Firewall (v0.16.5)
A critical defensive layer ensuring UI edits do not corrupt generation data.
-   **Frontend**: `ClipRow` ignores system fields (`resultUrl`, `status`) during text edits.
-   **Backend**: API Route (`/update_clip`) rejects any payload attempting to overwrite protected fields during a "Generation" cycle.

### 4. Universal Media Viewer (v0.25.1)
The centralized display engine.
-   **Hybrid Playlist**: Constructs a unified playlist of [Result URL, Explicit Refs, Auto-Resolved Refs] for comprehensive review.
-   **Full Cycle**: Restored capability to cycle through ALL attached images (Characters, Locations, References, Results) in one go.
-   **Smart Actions**: "Sideload" and "Unlink" actions correctly append/remove URLs from the persistence layer.

## Reference Logic (Evolution)
-   **v0.1**: Single URL.
-   **v0.10**: Comma-Separated String (`url1,url2`).
-   **v0.16**: "Hybrid" Logic (Explicit vs Legacy).
-   **v0.25 (Strict Mode)**: 
    -   **Kling**: Requires **Explicit Media Relation** (Drag & Drop) or fails validation (400 Bad Request). No implicit fallback to Characters.
    -   **Flux/Nano**: Supports hybrid/implicit references.
    -   **Performance**: DB Relations with valid Remote URLs (`http`) are used directly, bypassing the 30s upload phase to prevent Batch Timeouts.

## Download Strategy (v0.17.1)
-   **Format**: `[SCENE] [TITLE] [VER].ext` (e.g., `3.1 Explosion v1.mp4`).
-   **Mechanism**:
    -   **Local**: Direct `<a>` download.
    -   **Remote**: Proxy Route (`/api/proxy-download`) with aggressive header sanitization and enforced "New Tab" (`_blank`) delivery to prevent UI blocking.
