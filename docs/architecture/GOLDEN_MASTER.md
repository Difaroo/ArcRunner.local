# Golden Master Architecture Reference

> **Immutable Truths**
> This document serves as the single source of truth for critical system configurations. 
> ANY code change that contradicts this document requires a documented update here first.

## 1. Model Definitions

### Nano (Banana/Google)
-   **Type**: **IMAGE GENERATOR**
-   **Output Format**: PNG
-   **Provider**: Google (via Banana/Kie)
-   **Usage**: Fast image generation, establishing shots.
-   **Behavior**: Default persistence is **Local Download**.
-   **Start Frame Logic**: Supports "Start Frame" (Image-to-Image) logic.
-   **Video Capability**: **NONE** (Strictly enforced).

### Veo (Google)
-   **Type**: **VIDEO GENERATOR**
-   **Output Format**: MP4
-   **Behavior**: Remote URL (Service) + Thumbnail.
-   **Start Frame Logic**: Ignored (Video models use temporal inputs).

### Kling (Kuaishou)
-   **Type**: **VIDEO GENERATOR**
-   **Output Format**: MP4 (Remote)

### Flux (Black Forest Labs)
-   **Type**: **IMAGE GENERATOR**
-   **Output Format**: PNG (Local Download)

## 2. Persistence Strategy

### Image Models (Flux, Nano)
-   **Rule**: **ALWAYS DOWNLOAD**.
-   **Storage**: `/public/media/library` or `/public/media/clips`.
-   **Reasoning**: Local assets ensure fast loading, offline capability, and no link rot.

### Video Models (Veo, Kling)
-   **Rule**: **REMOTE URL + THUMBNAIL**.
-   **Storage**: Database stores the Remote URL. Local filesystem stores a generated thumbnail.
-   **Reasoning**: Video files are large; extensive storage management required if downloaded.

## 3. Polling Logic
-   The Poller distinguishes persistence strategy based on **Model Type**, not just extension.
-   However, extension checks (`.mp4`) are permitted as a safety net for legacy/rogue data.

