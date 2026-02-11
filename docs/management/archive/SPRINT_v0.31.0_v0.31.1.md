# Sprint Archive v0.31.0 & v0.31.1 - Peregrine (Vibe Menu & Data Safety)

## Release v0.31.0 (Vibe Menu & Asset Scroller)
- [x] Fix display of Video elements in Batch Edit Modal Vibe Menu <!-- id: 0 -->
- [x] Add type icons to Vibe Menu items <!-- id: 1 -->
- [x] Harmonize Vibe Menu icons: Use `play_arrow` for Video, `image` for Image <!-- id: 2 -->
- [x] Harmonize Asset Scroller icons: `person` for Character, `location_on` for Location <!-- id: 3 -->
- [x] Fix Asset Scroller: Add Reference Images section with `image` icon <!-- id: 4 -->
- [x] Refactor AssetPreviewStrip: Separate Scroller (grey panel) and Latest Result (transparent) <!-- id: 5 -->
- [x] Enable horizontal scrolling for Asset Scroller (`min-w-0` fix) <!-- id: 6 -->
- [x] Display Previous Results in Scroller with `auto_awesome` (img) / `play_arrow` (vid) icons <!-- id: 7 -->
- [x] Fix horizontal scroll interaction: Prevent browser navigation swipe (`overscroll-x-contain`) <!-- id: 8 -->
- [x] Fix API: Include `mediaResults` in `GET /api/clips` response so history is available <!-- id: 9 -->
- [x] Fix: Batch Download causes result preview to disappear (allow 'Pending' status to show result) <!-- id: 22 -->

## Release v0.31.1 (Data Safety & Vibe Sort)
- [x] Harden `deploy-migration.sh` with auto-backup <!-- id: 30 -->
- [x] Create `safe-migrate-dev.sh` with auto-backup <!-- id: 31 -->
- [x] Update `package.json` scripts <!-- id: 32 -->
- [x] Verify backup generation <!-- id: 33 -->
- [x] Recover `dev.db` from backup `dev.db.backup_v0.31.0_20260209_140931` <!-- id: 26 -->
- [x] Recover Latest Data: Restore `prod_v2.db.backup` (191 clips) to `dev.db` <!-- id: 27 -->
- [x] Merge Vibe Menu: Import 6 saved Vibes into new DB <!-- id: 28 -->
- [x] Data Preservation: Export `Vibe` data from `dev.db` <!-- id: 17 -->
- [x] Schema Migration: Generate `Vibe` table migration SQL <!-- id: 18 -->
- [x] Deploy to Prod: Apply migration to `prod_v2.db` <!-- id: 19 -->
- [x] Data Migration: Import `Vibe` data to `prod_v2.db` <!-- id: 20 -->
- [X] EMERGENY: Restore `prod_v2.db` from backup `prod_v2.db.backup_v0.31.0_20260209_140843` <!-- id: 29 -->
- [x] Fix Vibe Menu API 500 Error (Schema Migration Mismatch) <!-- id: 25 -->
- [x] Implement Vibe Menu Item Editing (Title + Prompt) <!-- id: 23 -->
- [x] Implement Vibe Menu Drag-and-Drop Sorting & Live Updates <!-- id: 24 -->

## Status
- **Date**: 2026-02-11
- **Outcome**: Success. Critical data safety infrastructure established. Vibe Menu feature set complete.
