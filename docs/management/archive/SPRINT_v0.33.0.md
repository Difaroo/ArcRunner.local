# Sprint v0.33.0 - Kestrel (BEM Overhaul & Generate Alignment)

**Date**: 2026-02-26
**Version**: 0.32.4 → 0.33.0

## Scope
BEM asset management overhaul, generate button alignment across all surfaces, media persistence state machine hardening, server-side file operations, and UI polish sprint.

## Completed Items

### BEM Enhancements
- [x] Type icon sizing for MIS (image/video)
- [x] Persistent unlink button (orange outline, always visible)
- [x] Overflow slot label outline styling
- [x] Download/Open Folder button in Latest Result header
- [x] Generate button in header bar (left of Save)

### Server-Side File Operations
- [x] `DELETE /api/media/delete-local` — delete local cache + symlink
- [x] `POST /api/media/open-folder` — open episode folder in Finder

### Generate Button Alignment
- [x] Row generate → `handleGenerateSingle` → confirmation dialog
- [x] BEM generate → same flow
- [x] Icon consistency: `movie_creation`/`image` by model type
- [x] `onGenerateSingle` prop threaded page.tsx → ActionToolbar → BEM

### UI Polish Sprint
- [x] Header traffic light aligned with checkbox (removed mt-1.5)
- [x] Grab pad vertically centered + traffic light colored
- [x] Row generate icon matches batch button

### Fixes
- [x] `isPersisted` reset on regeneration (was stale across re-gen)
- [x] Data cleanup: 130 stale flags reset, 5 valid kept
- [x] BEM filmstrip 500 error (re-persist on persisted clip)
- [x] UVM filmstrip opens folder (was silently failing)
- [x] Kling 422 image size debugging

## Architecture Changes
- `handleGenerateSingle` — new unified single-clip generate handler
- `executeClipGeneration` — dual-mode (single/batch)
- `onGenerateSingle` prop chain: page.tsx → ActionToolbar → BEM

## Files Changed (25)
- `src/app/page.tsx`
- `src/components/clips/BatchEditModalV3.tsx`
- `src/components/clips/ActionToolbar.tsx`
- `src/components/clips/ClipRow.tsx`
- `src/components/clips/ClipTable.tsx`
- `src/components/clips/ModelInputSlotsV2.tsx`
- `src/components/clips/ClipAssetScroller.tsx`
- `src/components/media/UniversalMediaViewer.tsx`
- `src/components/media/MediaDisplay.tsx`
- `src/components/ui/RowActions.tsx`
- `src/app/api/clips/route.ts`
- `src/app/api/update_clip/route.ts`
- `src/app/api/media/route.ts`
- `src/app/api/media/add-ref/route.ts`
- `src/app/api/media/unlink/route.ts`
- `src/lib/generate-manager.ts`
- `src/lib/storage.ts`
- `src/types/index.ts`
- `prisma/schema.prisma`
- `scripts/cleanup_persisted.ts`
