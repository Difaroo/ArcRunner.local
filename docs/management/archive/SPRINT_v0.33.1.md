# Sprint: v0.33.1 — Data Integrity & BEM Polish
**Date**: 2026-02-28

## Objectives
- Fix thumbnail/result URL desynchronization across clips with multiple generation results
- Fix BEM Asset Pool scope (episode-wide → clip-specific)
- Polish MIS empty state, icons, tooltips, and header alignment

## Completed Items

### Data Integrity
- [x] Cleaned 13 clips with stale multi-result CSV in `clip.resultUrl` → set to latest Media table URL
- [x] Fixed 4 clips with expired CDN URLs in `resultUrl` where local copies existed → set to local
- [x] Regenerated clip 273 thumbnail from correct local video file
- [x] Confirmed pipeline (poll route + MediaService.addResult) is correct — no code fix needed, purely stale data

### BEM Asset Pool
- [x] Switched pool data source from episode-wide `/api/media?episodeId=...` to clip-specific `clip.mediaReferences`
- [x] Pool now correctly shows only the current clip's references

### MIS Container
- [x] Empty state: min-width holds at 180px (one card width), centered "ADD REFERENCE" graphic
- [x] Populated state: container hugs actual cards (w-fit), no extra space
- [x] Fixed `calculatedSlotWidth` persistence — resets to null when slots are empty
- [x] Inline style only applies when `uiSlots.length > 0`
- [x] Circle border set to 50% opacity, "+" icon uses Material Symbols to match header buttons
- [x] Added orange max input count badge from model config to MIS header

### Icon & UX Polish
- [x] Replaced `theaters` (film strip) icon → `folder` in BEM, UVM, and RowActions
- [x] Changed sideload tooltip: "Sideload result to MIS" → "Make reference image"
- [x] Changed sideload button: `variant="outline"` → `variant="ghost"` (no border)
- [x] Aligned Latest Result header with Pool and MIS headers (same `px-3 py-1 h-[34px]`)

### Cleanup
- [x] Deleted deprecated `BatchEditModalV2.tsx` (948 lines)
- [x] Deleted deprecated `MediaPreviewModal.deprecated.tsx` (165 lines)
- [x] Deleted deprecated `PromptConstructor_DRAFT.ts` (68 lines)

## Files Modified
- `src/components/clips/BatchEditModalV3.tsx` — Pool scope, MIS width, header alignment, icons, tooltips
- `src/components/clips/ModelInputSlotsV2.tsx` — Empty state centering, circle opacity, icon weight
- `src/components/media/UniversalMediaViewer.tsx` — theaters → folder icon
- `src/components/ui/RowActions.tsx` — theaters → folder icon
- `prisma/dev.db` — Data cleanup (CSV→single URL, CDN→local)
