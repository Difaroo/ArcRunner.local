# ArcRunner Render Engine Architecture (v0.17.1)

## Architecture Overview
The ArcRunner Render Engine is a high-availability polling infrastructure designed to bridge the gap between a stateful React UI and the asynchronous Kie.ai Generation API. It prioritizes **Data Integrity**, **Self-Healing**, and **User Visibility**.

### Core Flow
1.  **Trigger**: User initiates generation via UI (Episode or Studio).
2.  **Payload Construction**: The `GenerateManager` selects the appropriate Strategy (`Flux`, `Veo`, `Nano`, `Kling`) based on inputs (Text, Image count).
3.  **Submission**: A `POST` request is sent to Kie.ai.
4.  **Task Tracking**: The Task ID (`taskId`) and initial inputs are persisted immediately to the Database (`Clip` or `StudioItem`).
5.  **Polling Loop**: The frontend `usePolling` hook (or centralized Polling Service) queries the status of active tasks.
6.  **Resolution**: Upon completion (`Done`), the result URL is secured (downloaded/proxied) and the DB is updated.

## Key Components

### 1. Payload Builders (`src/lib/builders/*`)
Each model family has a dedicated builder ensuring strict adherence to API schemas.
-   **Flux**: Handles Style Injection, Strength mapping (UI 1-10 -> API 1.5-10.0), and Aspect Ratio.
-   **Veo**: Manages complex `IMAGE_TO_VIDEO` (S2E), `TEXT_2_VIDEO`, and `REFERENCE_2_VIDEO` tasks with automatic fallback logic.
-   **Kling**: Enforces strict "Single Explicit Reference" priority (v0.17.1 update) to prevent style bleeding.
-   **Nano**: Specialized builder for banana-pro pipelines.

### 2. Polling Infrastructure (`src/app/api/poll/route.ts`)
The heartbeat of the engine.
-   **Zombie Killer**: Automatically marks tasks as `Error` if they remain in "Generating" state without a valid remote ID for > 45s (upload timeout).
-   **Smart Merge (v0.16.2)**: Intelligently merges polling results with local optimistic state to prevent UI flicker.
-   **Result Ordering**: Ensures the newest result is always prepended to the CSV list.

### 3. Data Integrity Firewall (v0.16.5)
A critical defensive layer ensuring UI edits do not corrupt generation data.
-   **Frontend**: `ClipRow` ignores system fields (`resultUrl`, `status`) during text edits.
-   **Backend**: API Route (`/update_clip`) rejects any payload attempting to overwrite protected fields during a "Generation" cycle.

### 4. Universal Media Viewer (v0.17.1)
The centralized display engine.
-   **Hybrid Playlist**: Constructs a unified playlist of [Result URL, Explicit Refs, Auto-Resolved Refs] for comprehensive review.
-   **Smart Actions**: "Sideload" and "Unlink" actions now correctly append/remove URLs from the persistence layer without overwriting existing data.
-   **Z-Index Layout**: High-priority overlay (`z-[9999]`), but strictly below Critical Alerts (`z-[10000]`).

## Reference Logic (Evolution)
-   **v0.1**: Single URL.
-   **v0.10**: Comma-Separated String (`url1,url2`).
-   **v0.16**: "Hybrid" Logic:
    -   `explicitRefUrls`: User-added images (Always Shown).
    -   `refImageUrls`: Legacy/Resolved images (Filtered if duplicates).
-   **v0.17**: **Unified Sync**: Edit Mode now writes to BOTH fields to ensure backward compatibility while preserving explicit user intent.

## Download Strategy (v0.17.1)
-   **Format**: `[SCENE] [TITLE] [VER].ext` (e.g., `3.1 Explosion v1.mp4`).
-   **Mechanism**:
    -   **Local**: Direct `<a>` download.
    -   **Remote**: Proxy Route (`/api/proxy-download`) with aggressive header sanitization and enforced "New Tab" (`_blank`) delivery to prevent UI blocking.
