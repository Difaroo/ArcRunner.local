# Sprint: v0.33.2 — Veo S2E Payload & BEM Fixes

## Context
A targeted bug fix release restoring stability to the Veo Start-to-End generation pipeline and improving the Batch Edit Modal's interactivity. Previous API rule changes by Kie.ai caused local payload generation to fail silently; this patch brings ArcRunner into strict compliance with the Veo 3.1 image URL requirements.

## Fixes
- **Veo Start-to-End Payload Integration**:
  - **Root Cause**: The Kie.ai API deprecated raw Base64 injection for Veo 3.1 and required `imageUrls`. ArcRunner's legacy `PayloadBuilderVeo` coerced images into Base64 buffers. Additionally, the `IMAGE_2_VIDEO` generation type was actively rejected for S2E transitions.
  - **Fix**: Reverted the Base64 buffering flow inside `GenerateManager`, aligning Veo payload uploading with Kling and Nano. Refactored the payload type explicitly to `FIRST_AND_LAST_FRAMES_2_VIDEO`.
  - **Result**: Immediate generation stability with accurate 2-frame S2E interpolation payloads.

- **Universal Viewer Playlist Detection**:
  - **Root Cause**: Next.js mapped extension-less Signed URLs from Google Cloud Storage (`googleapis.com`) as standard static images. S2E renders were injected into the UI as broken `<img />` tags.
  - **Fix**: Updated `ClipRow.tsx`'s internal type-resolver to execute strict model flag checks (`isVideoModel(clip.model)`). Videos always mount as `<video />` players.

- **BEM Download & Persistence Button**:
  - **Root Cause**: Navigating to the Batch Edit Modal and clicking the persistent "Download" button on a freshly generated video would trigger a silent local 404. React knew about the video, but the backend `/api/media/persist` routed off the stale `clip.resultUrl` in the SQLite DB (which was empty).
  - **Fix**: Threaded an explicit `url` bypass. The BEM actively injects its local React state URL (`clip.resultUrl`) directly into the `useMediaPersistence` hook, which now forces `/api/media/persist` to skip the DB lookup if a valid URL arrives.
