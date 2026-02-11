# ArcRunner Backlog

## 🩹 Bugs / Technical Debt
- [ ] **Ghost Servers**: Ensure `kill-port` is robust across all OS versions.
- [ ] **Thumbnail FFMPEG**: Validate `ffmpeg-static` on Windows/Linux (currently Mac optimized).
- [ ] **Type Definitions**: Consolidate shared types (currently split between `lib` and `api`).

## 🎬 Episode / Clips
- [ ] **Extended Edit Mode**: Expose other fields + controls in the inline edit view.
- [ ] **Multi-Delete**: Select multiple clips and delete in batch.
- [ ] **Glitch**: "Save" button triggers other save buttons or UI states incorrectly.


## 🚀 Released v0.31.2 (Movement & Payload)
- [x] **Movement Field**: Implemented dedicated `movement` field, separated from Camera.
- [x] **Vibe Menu**: Added "Movement" vibes and integration.
- [x] **Payload Logic**: Integrated movement into Veo and Legacy prompt construction.

## 🚀 Released v0.31.1 (Data Safety & Sort)
- [x] **Safe Migrations**: Enforced auto-Backup for `migrate:dev` and `migrate:deploy`.
- [x] **Production Recovery**: Restored `prod_v2.db` and merged Vibe data.
- [x] **Vibe Sorting**: Implemented Drag-and-Drop reordering for Vibe Menu.
- [x] **Vibe Editing**: Implemented inline editing for Vibe items.

## 🚀 Released v0.31.0 (Vibe Menu & Asset Scroller)
- [x] **Asset Scroller**: Refactored layout, enabled horizontal scroll, added `overscroll-x-contain`.
- [x] **History Display**: Scroller now shows full result history with correct icons.
- [x] **Video Previews**: Vibe menu and history items support video playback.
- [x] **API Fix**: `/api/clips` now returns `mediaResults` for history.

## 🚀 Released v0.30.1 (System Restoration)
- [x] **Database Restore**: Restored Dev DB from Production (Fixes "Empty Data" issue).
- [x] **Schema Revert**: Rolled back experimental `Vibe` table.
- [x] **Stability**: Synced code to match database schema.

## 🚀 Released v0.30.0 (Media Library Infinite Scroll)
- [x] **Infinite Scroll**: Implemented progressive loading for Media Library (replaces pagination).
- [x] **Performance**: Optimized rendering for large media collections.
- [x] **UX Enhancement**: Seamless browsing without manual page navigation.

## 🚀 Released v0.29.2 (Sort & Layout Fixes)
- [x] **Ref Sorting**: Enforced LIFO (Newest First) sorting in API + Frontend Prepend.
- [x] **Location Thumb**: Fixed CSS nesting bug hiding location preview in Edit Mode.
- [x] **Studio Sort**: Aligned Studio Library sorting to LIFO.
- [x] **Caching**: Added `force-dynamic` to Update API.

## 🚀 Released v0.29.1 (Live Update & Veo S2E Fixes)
- [x] **Character Live Update**: Fixed bug where thumbnails didn't update instantly in Edit Mode.
- [x] **Location Thumb Fix**: Fixed Location thumbnail disappearing in Edit Mode.
- [x] **Ref Image Ordering**: Switched to FIFO (Oldest First) to respect drag-and-drop order.
- [x] **Veo Start-to-End**: Fixed Backend LIFO sort bug that reversed Start/End frames in payload.

## 🚀 Released v0.29.0 (History & Performance)
- [x] **Result History**: Universal Viewer now shows full history of results (Playlist).
- [x] **Instant Download**: Optimised `proxy-download` to stream response (Zero Delay).
- [x] **Relational Cleanup**: Refactored `ClipRow` to use `mediaResults` table, removing CSV legacy.
- [x] **Reverts**: Cleaned up experimental Video Sideload logic.

## 🚀 Released v0.28.0 (Legacy CSV Removal)
- [x] **Legacy Removal**: Stopped writing to `refImageUrls` and `resultUrl` CSV columns.
- [x] **Strict Media-First**: Frontend/Backend now strictly read from `Media` table.
- [x] **Frontend Fix**: Added `onAddReference` API to `ClipRow` for direct relational writes.
- [x] **Verification**: "Ghost Test" passed (legacy data invisible).
- [x] **Security**: Automated browser testing confirmed Strict Mode.

## 🚀 Released v0.27.0 (Studio Viewer & Navigation)
- [x] **Studio Asset Viewer**: Character thumbnails now open Universal Viewer (matching location behavior).
- [x] **Chevron Logic**: Fixed chevrons showing for single-image assets.
- [x] **Generate Validation**: Fixed validation to check Media table instead of legacy string fields.
- [x] **Media Flash Fix**: Eliminated flash of stale episode data when changing episodes.
- [x] **Navigation Consistency**: Episode state now persists when navigating Media → Episode.

## 🚀 Released v0.26.0 (Strict Sort & Integrity)
- [x] **Strict Media Sorting (Raw SQL)**: Implemented Series->Episode->ClipOrder sorting to mirror Drag-and-Drop.
- [x] **Start Frame Fix**: Disabled aggressive character filtering in `GenerateManager` (false negatives).
- [x] **Media Integrity**: Ensured `episodeId` population on all generated results.
- [x] **Unlink Logic**: Fixed Start Frame/Location "Unlink" behavior (removing name vs deleting asset).

## 🚀 Released v0.25.0 (Viewer Stability & Prompt Fixes)
- [x] **Smart Sideload**: Universal Viewer keeps open and advances to next results when moving items to refs.
- [x] **Ref Unlink**: Unlinking references properly detaches generic media and closes viewer.
- [x] **Prompt Logic**: Fixed Location Image Resolution (broadened to include Refs/Generated and robust naming).
- [x] **UI Polish**: Aligned Edit/Display padding for Clip Rows.

## 🚀 Released v0.24.0 (Stability & Persistence)
- [x] **Camera Persistence**: Fixed bug where Camera and Style fields were not saving due to frontend whitelist.
- [x] **Location Persistence**: Fixed "bouncing back" issue in Prod via Caching analysis.
- [x] **Production Stability**: Migrated to **PM2** for robust process management (No more zombies).
- [x] **Database Lock Fix**: Resolved "Readonly Database" error by migrating to fresh `prod_v2.db`.
- [x] **Documentation**: Added "System Context" to Playbook and documented Server Ops.

## 🚀 Released v0.21.0 (Reference Grid & Data Stability)
- [x] **Ref Grid Experience**: Expanded to 3x3 layout (9 images) with LIFO ordering.
- [x] **Nano Persistence**: Fixed model ID saving to ensure correct polling strategy.
- [x] **Database Architecture**: Formalized separation of Dev/Prod databases.
- [x] **Data Integrity**: Restored missing `Media` records for legacy clips.
- [x] **Viewer Safety**: Fixed Trash icon deleting clips; changed to Minus icon (Clear Result) in Episode View.
## 🚀 Released v0.23.2 (Batch Download & Media UX)
- [x] **Batch Download to Folder**: Users can now select a destination folder once and download all selected clips without individual save dialogs.
- [x] **Media Gallery UV Click**: Fixed z-index issue preventing cards from opening Universal Viewer on click.

## 🚀 Released v0.23.1 (Bug Fixes & Polish)
- [x] **Clip Title Save**: Added `title` to ClipRow's ALLOWED_FIELDS - title changes now persist.
- [x] **Library/Studio Save**: Refactored LibraryRow save with whitelist+diff pattern.
- [x] **Duplicate Positioning**: Fixed rows duplicating to bottom instead of after source.
- [x] **Prompt Builder (Nano)**: Fixed repeated ref context text in Nano prompts.
- [x] **Aspect Ratio**: Generation now uses Episode's ratio (was hardcoded 16:9).
- [x] **Video Refs in UV**: Fixed blank video display in Universal Viewer.
- [x] **UV Download**: Downloads now happen inline without opening new tabs.

## 🚀 Released v0.23.0 (Media Data Architecture)
- [x] **Single Source of Truth**: Migrated `Media` model to be directly linked to `Episodes`, decoupling it from Clips.
- [x] **Persistence Fix**: Unlinking results no longer causes them to reappear (recursive cleanup of Clip legacy fields).
- [x] **Preview Fix**: Fixed blank previews for Image results (ClipRow now intelligently discriminates content type).
- [x] **Ghost Thumbnail Fix**: "Add as Ref" (move result) now correctly clears the original clip's thumbnail.
- [x] **Unified Playlist**: Clicking a Reference Image thumbnail now opens a playlist that includes the Result (if present).
- [x] **Migration**: Successfully promoted Dev DB schema and data to Production.

## 🚀 Released v0.22.1 (Sideload Polish)
- [x] **UX**: "Add as Ref" in Universal Viewer now immediately sideloads results to the current clip (bypassing dialog).

## 🚀 Released v0.22.0 (Persistence & Reference UX)
- [x] **Dialog Fix**: Fixed crash in "Add to Clip" dialog caused by Episode Object handling.
- [x] **Context Awareness**: "Add to Clip" dialog now respects the active Series filter.
- [x] **UI Polish**: Styled "Move" button (Dialog) to Orange Outline; kept Viewer button minimal (Ghost).
- [x] **Bug Fix**: Fixed "Failed to add reference" logic (missing source context) and improved error reporting.
- [x] **UX**: "Move" button now *always* opens dialog (removed confusing auto-promote behavior).
- [x] **Data Safety**: Implemented `/api/media/unlink` to fix data loss (ghost state) when removing clips from references.
- [x] **UX**: Reference Image thumbnails now click to open Universal Viewer (playlist mode).
- [x] **UX**: Series/Episode selection is now persistent (LocalStorage) across page reloads and navigation.
- [x] **Stability**: Fixed "Persistence Race Condition" where default values overwrote saved session state on mount.

## 🚀 Released v0.21.0 (Reference Grid & Data Stability)
- [x] **Ref Grid Experience**: Expanded to 3x3 layout (9 images) with LIFO ordering.
- [x] **Nano Persistence**: Fixed model ID saving to ensure correct polling strategy.
- [x] **Database Architecture**: Formalized separation of Dev/Prod databases.
- [x] **Data Integrity**: Restored missing `Media` records for legacy clips.
- [x] **Viewer Safety**: Fixed Trash icon deleting clips; changed to Minus icon (Clear Result) in Episode View.
- [x] **Media Gallery Actions**: Enabled "Add to Clip" (Move) functionality in the Media Gallery Viewer.

## 🚀 Released v0.20.0 (Image Manifest & Reference Workflow)
- [x] **Image Manifest Priority**: Model-specific limits (Veo 3, Kling 1, Nano/Flux 8).
- [x] **Priority Order**: Style → Location → Characters → Refs.
- [x] **Ref Ordering**: Refs prepend (latest first) for I2V priority.
- [x] **Add-as-Ref Refactoring**: Results move; Refs copy/move via dialog.
- [x] **Media Move Logic**: Clears source resultUrl when moving to refs.
- [x] **Universal Viewer Cleanup**: Removed duplicate Airplay button.

## 🚀 Released v0.19.1 (Download Standardization)
- [x] **Ref Integrity**: Fixed "Reappearing Thumb" bug via Dual-Write restoration.
- [x] **Studio Sync**: Aligned Studio Item reference logic with Clips.
- [x] **Edit Mode**: Fixed Location Thumbnail disappearance.
- [x] **UI Polish**: Removed Chevrons, aligned Studio Toolbar width.

## 🚀 Released v0.17.0 (Falcon)
- [x] **Data Integrity Firewall**: Whitelist/Sanitization to prevent result overwrites.
- [x] **Kling Priority**: Explicit override logic.
- [x] **Visibility Logic**: Hybrid deduplication for reference images.
- [x] **Prompt Safety**: Kling truncation (2000 chars).

## 🚀 Released v0.16.2 (Phoenix Stability)
- [x] **Nano Polling Loop**: Fixed infinite "Generating" loop for Nano models.
- [x] **Model Persistence**: Fixed data loss where `model` field wasn't saved to DB.
- [x] **Smart Merging**: Prevented Zombie Killer from destroying valid tasks during slow updates.
- [x] **Regression Testing**: Added `test-integrity.ts`.

## 🚀 Released v0.16.1 (Bugfix & Polish)
- [x] **Spinner Flicker**: Fixed race condition in Poller that caused premature stops.
- [x] **Style Payload Logic**: Fixed bug where style header was missing or incorrect for Text-Only styles.
- [x] **Data Robustness**: Added grace periods to `usePolling` and `generate-manager`.
- [x] **UI Polish**: Standardized Clip/Series views.

## 🚀 Released v0.16.0 (Griffin)
- [x] **Start-to-End Frame**:
    - [x] Capture frames of Clips (preview?).
    - [x] In/Out points for morphing?
    - [x] Complex actions/Clip types.

## 🎨 Studio Screen
- [ ] **Seed Manager**: Manage/Recall favorite seeds.
- [ ] **Episode # in Studio**: Visible/Current Episode indicator.
- [ ] **Camera & Motion**:
    - [x] Break out Camera + Motion into stacked fields.
    - [ ] Generate complete set of cameras + shot types (Tracking, etc.).

## 📋 Storyboard
- [ ] **Make Editable**: Allow drag-to-reorder and text editing directly on cards.

## 📄 Series / Scripting
- [ ] **Mega Prompt Update**: Inject Episode Number into library prompts via {{LIBRARY_KEYS}}.
- [ ] **Script Processing**: AI Agent to process Script Text -> JSON -> Studio Assets -> Episodes.
- [ ] **Script Markup**: Support markup for descriptions/Studio links.
