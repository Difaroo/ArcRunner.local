# Project History & Architecture Log

This document serves as a rolling historical record of what was implemented, why it was implemented, and the architectural decisions behind it.

## 2026-02-06: v0.30.0 - Peregrine (Media Library Infinite Scroll)

### Context
A UX enhancement release focused on improving the Media Library browsing experience. Users reported that pagination controls were slowing down their workflow when reviewing large collections of generated media. This release implements infinite scroll to enable seamless browsing without manual page navigation.

### Key Changes
- **Infinite Scroll Implementation**:
    - **Progressive Loading**: The Media Library now loads content progressively as users scroll, replacing the traditional pagination controls.
    - **Performance**: Optimized rendering to handle large media collections without performance degradation.
    - **Smooth Experience**: Users can now browse their entire media library with a single continuous scroll, eliminating the friction of clicking through pages.
- **Technical Details**:
    - **File Modified**: `src/app/media/client.tsx` (94 insertions, 11 deletions).
    - **Architecture**: Implemented scroll-based triggers for loading additional media batches.

### Version Bump
- **Minor**: 0.29.2 → 0.30.0.

---

## 2026-02-03: v0.29.2 - Peregrine (Sort & Layout Fixes)

### Context
A fast-follow release addressing two primary friction points: The "Reference Image" sorting logic and a regression in "Edit Mode" layout for Location thumbnails.

### Key Fixes
- **Reference Sorting (LIFO)**:
    - **Logic**: Updated the API to sort `mediaReferences` by `id: 'desc'` (Newest First). This matches the frontend's optimistic "prepend" logic (`[New, ...Old]`), ensuring that the most recently added image (Start Frame) reliably stays at the #1 slot.
    - **Stability**: Added `export const dynamic = 'force-dynamic'` to the update API to prevent Next.js from serving stale (cached) reference orders.
- **Location Thumbnail Layout**:
    - **Bug Fix**: Fixed a CSS issue where the Location Preview `div` was nested inside an `items-center` flex row, causing it to collapse/disappear. Moved it to a parent vertical flex container to ensure visibility.
- **Studio Alignment**:
    - **Propagation**: Applied the same `id: 'desc'` sorting logic to the Studio Library API (`/api/library`), ensuring consistency across the entire app.

### Version Bump
- **Patch**: 0.29.1 -> 0.29.2.

---

## 2026-02-01: v0.29.1 - Peregrine (Live Update & Veo S2E)

### Context
A robust "Bug Hunt" release addressing critical feedback on the user interface responsiveness and generation logic. Key fixes include "Instant Live Updates" for Character/Location thumbnails in Edit Mode (removing the need to save/refresh to see changes), and a definitive fix for the "Veo Start-to-End" payload logic, ensuring that the **Start Frame** and **End Frame** are sent in the correct order (FIFO) instead of being reversed by backend sorting.

### Key Fixes
- **Live Update Architecture**:
    - **Character Thumbs**: The `ClipRow` editor now renders Character Reference thumbnails using the **Live `editValues`** state instead of the persisted database state. Typing or removing a character updates the preview instantly.
    - **Location Thumbs**: Applied similar logic to the Location cell, fixing a bug where the thumb disappeared upon entering Edit Mode.
- **Payload Integrity**:
    - **Ref Image Sorting (FIFO)**: Switched the backend `GenerateManager` sort order for Media References from **Descending** (Newest First) to **Ascending** (Oldest First). This matches the user's Drag-and-Drop intent: The first image added (Start Frame) remains at Index 0.
    - **Veo S2E Logic**: Confirmed that `PayloadBuilderVeo` respects this order, fixing the issue where Start and End frames were swapped.

### Version Bump
- **Minor**: 0.29.0 -> 0.29.1.

---

## 2026-02-01: v0.29.0 - Peregrine (History & Performance)

### Context
This release delivers two highly requested improvements: **Full Result History** and **Instant Downloads**. The Universal Viewer now allows users to browse through *all* previous generation results for a clip, not just the latest one. Additionally, the file download architecture has been completely rewritten to use **Streaming**, eliminating the 10-second "buffering delay" before the Save Dialog appears.

### Key Changes
-   **Result History (Time Machine)**:
    -   **Full Playlist**: The Universal Viewer now stacks all historical results for a clip (stored via Relational DB). Users can swipe back to see previous iterations.
    -   **Strict Relations**: The frontend (`ClipRow`) now strictly reads `mediaResults` and `mediaReferences` relations, finalizing the deprecation of legacy CSV columns.
-   **Instant Downloads**:
    -   **Streaming Architecture**: Refactored the `/api/proxy-download` endpoint to stream data directly from source to client.
    -   **Zero TTFB**: The "Save As" dialog now appears instantly (milliseconds) instead of waiting for the full file to buffer on the server.
-   **Cleanup**:
    -   **Codebase Hygiene**: Removed experimental "Video Sideloading" logic and reverted checking for video refs in Nano payloads.

### Technical
-   **Refactor**: `ClipRow.tsx` refactored to use `clip.mediaResults` (Relation) instead of parsing `clip.resultUrl` (CSV).
-   **Version Bump**: 0.28.0 -> 0.29.0.

---

## 2026-02-01: v0.28.0 - Peregrine (Legacy CSV Abolition)

### Context
This milestone release marks the final abolition of the Legacy CSV Architecture (`refImageUrls`, `resultUrl`). The system now runs in **Strict Mode**, using the Relational `Media` table as the Single Source of Truth for all references and results. This ensures absolute data integrity and zero "ghost data".

### Key Changes
-   **Architecture**:
    -   **Strict Mode**: The API now completely ignores legacy CSV columns. Writes to these columns have been stripped.
    -   **Relational Source**: `ClipRow` and `MediaService` derive all state from `mediaReferences` relations.
-   **Frontend**:
    -   **Add-Ref API**: Drag-and-Drop actions now hit the `/api/media/add-ref` endpoint directly, bypassing legacy partial updates.
-   **Verification**:
    -   **Ghost Test**: Automated browser testing injected fake data into legacy columns and confirmed it remains invisible to the user.
-   **Version Bump**: 0.27.1 -> 0.28.0.

---

## 2026-02-01: v0.27.1 - Peregrine (Robust Unlinking & History)

### Context
A critical stability release addressing the fragility of the "Unlink" action and ensuring complete data integrity for generation history. Previous versions had issues where unlinking a reference could accidentally hide the Result video or leave orphaned database records. This release also introduces a "Full History" playlist in the Universal Viewer.

### Key Fixes
- **Robust Unlinking**:
    - **Studio Assets**: Fixed a bug where unlinking a Studio Asset (Character/Location) failed to remove the database relation unless the page was refreshed.
    - **Result Integrity**: Fixed a regression where unlinking a Reference Image sometimes caused the Result Video to disappear from the UI.
    - **UI Feedback**: Unlinking now provides instant visual feedback (removal) without requiring a reload.
- **History "Time Machine"**:
    - **Playlist Stack**: The Universal Viewer now builds a comprehensive playlist of ALL historical results (not just the latest one). Users can swipe back to see previous generations for the same clip.
    - **Data Safety**: Reverted the experimental "Result Demotion" logic. Historical results are now safely stored as a stacked history in the `resultUrl` CSV (soon to be pure Media relations) without being miscategorized as input references.
- **Viewer Polish**:
    - **Icons**: Added distinct "Film" icon for Video Results and removed the confusing "Eye" icon from Reference thumbnails.

### Technical
- **Refactoring**: Consolidated duplicate unlinking logic in `page.tsx`.
- **Version Bump**: 0.27.0 -> 0.27.1.

---

## 2026-01-31: v0.27.0 - Peregrine (Studio Viewer & Navigation)

### Context
A feature and stability release enhancing Studio asset interactions and resolving critical navigation consistency issues. Users can now view Studio assets (characters/locations) directly from clip rows, and episode navigation maintains proper state across all views.

### Features
- **Studio Asset Viewer Integration**:
    - **Character Click-to-View**: Character thumbnails in clip rows now open the Studio Asset Viewer on click, matching location functionality.
    - **Smart Chevron Logic**: Universal Viewer chevrons only appear when multiple media items exist (`playlist.length > 1`), preventing navigation UI for single-image assets.
    - **Validation Filter**: Studio asset viewer filters out invalid media entries (empty URLs) to ensure clean playlists.

### Bug Fixes
- **Generate Validation**: Updated `handleGenerateSelected` to check `mediaReferences` array instead of legacy string fields (`explicitRefUrls`, `refImageUrls`). Clips now correctly blocked from generation if missing reference images, preventing API errors.
- **Media Page Flash**: Added `key` prop to `LibraryTable` (`key={library-${currentSeriesId}-${currentEpKey}}`) to force component remount on episode change, eliminating flash of stale episode data.
- **Episode Navigation Consistency**:
    - **Media → Episode**: Navigation now passes `episodeId` and `seriesId` in URL parameters when returning from media view.
    - **Main Page URL Handling**: Added logic to read episode/series from URL params and set state accordingly, maintaining episode context across navigation.

### Technical Details
- **Episode ID Resolution**: Media page uses UUID-based episode IDs, main page uses integer episode numbers. Added mapping logic to find episode by UUID and extract number from `id` field.
- **Backward Compatibility**: Generate validation includes fallback to legacy string fields for clips not yet migrated to Media table.

### Version Bump
- **Minor**: 0.26.0 → 0.27.0.

---

# Project History & Architecture Log

This document serves as a rolling historical record of what was implemented, why it was implemented, and the architectural decisions behind it.

## 2026-01-28: v0.26.0 - Peregrine (Strict Sort & Integrity)

### Context
A feature and stability release addressing the Media Gallery's sorting logic and generation integrity. We implemented "Strict Clip-Order Sorting" using Raw SQL to ensure the gallery perfectly mirrors the Episode Board's drag-and-drop order. We also hardened the generation pipeline to prevent "Start Frame" logic from accidentally filtering out valid characters.

### Features
- **Strict Media Sorting (Raw SQL)**:
    - **Logic**: Replaced ORM sorting with a Raw SQL query: `Series -> Episode -> Clip SortOrder -> Time`.
    - **Benefit**: "Result" videos and "Reference" images for the same scene now always appear together, interleaved correctly even after reordering scenes.
- **Generation Logic**:
    - **Start Frame Fix**: Disabled aggressive character filtering in `GenerateManager`. Characters are now always attached to the payload, preventing false negatives where "Name (Suffix)" mismatches caused characters to be dropped.
    - **Media Integrity**: Updated `GenerateManager` to ensure all generated results create a `Media` record with an `episodeId`, fixing visibility bugs in the gallery.
- **Data Safety**:
    - **Unlink Logic**: Updated `handleUnlink` (Studio Item Context) to remove the Studio Item's *Name* from clipped metadata fields instead of deleting the asset itself.

### Version Bump
- **Minor**: 0.25.1 -> 0.26.0.

---

## 2026-01-26: v0.25.1 - Peregrine (Strict Refs & Performance)

### Context
A critical fix release enforcing data integrity for Kling generation and resolving batch performance bottlenecks. It also restores the full "Chevrons" capability for cycling through all attached media.

### Changes
- **Kling Strict Mode**:
    - **Validation**: Enforces presence of **Explicit Reference Images** (Drag & Drop) for Kling generation. Returns 400 Bad Request if missing, preventing failed credits.
    - **Performance**: Optimizes batch processing by using existing Remote URLs (`http`) from the DB instead of re-uploading local files, eliminating 30s timeouts.
- **Universal Viewer**:
    - **Playlist Restoration**: Fixed `ClipRow` logic to restore cycling through *all* attached images: Result Video -> Explicit Refs -> Character Refs -> Location Refs.
- **Verification**:
    - **Tested**: Render functions tested for Nano and Kling (Confirmed Working). Veo pending.
- **Version Bump**: 0.25.0 -> 0.25.1.

## 2026-01-25: v0.25.0 - Peregrine (Viewer Stability & Prompt Fixes)

### Context
A stability and polish release focused on the "Universal Viewer" workflow and prompt generation reliability. It resolves critical friction points in the Sideload/Referencing loop and fixes a long-standing issue with Location Reference resolving.

### Features
- **Smart Sideload**: "Add as Ref" in the Universal Viewer now keeps the viewer open and automatically "Advances" to the next result, enabling rapid-fire sorting of batch generations.
- **Reference Unlink**: Unlinking a Reference Image (`-`) now properly detaches the Media record and closes the viewer, providing clear "Task Complete" feedback.

### Bug Fixes
- **Prompt Generation**: Fixed `Location Image` resolution logic. The generator now correctly resolves Location images even if they are "References" (not just Uploads) and handles space/underscore naming discrepancies robustly.
- **UI Alignment**: Reduced Edit Mode padding for standard text inputs (Title, Scene, etc.) to eliminate the visual jump when switching between Read/Edit modes.
- **Viewer Context**: Fixed logic where the Universal Viewer would sometimes lose its playlist context or fail to perform Sideloads due to missing event handlers.

---

## 2026-01-18: v0.23.2 - Osprey (Batch Download & Media UX)

### Context
A UX improvement release focused on streamlining batch operations and fixing media gallery interactions.

### Features
- **Batch Download to Folder**: Implemented File System Access API (`showDirectoryPicker`) for batch downloads. Users now select a destination folder once, and all selected clips save directly without individual save dialogs. Falls back to sequential downloads on unsupported browsers.

### Bug Fixes
- **Media Gallery UV Click**: Fixed click handler z-index issue where video overlay and controls were blocking the click-to-view functionality. Cards now properly open Universal Viewer on click.

---

## 2026-01-18: v0.23.1 - Osprey (Bug Fixes & Polish)

### Context
A quality-of-life release addressing multiple UX and functional bugs reported during Osprey testing. Focused on data persistence, media handling, and generation parameters.

### Bug Fixes
- **Clip Title Save**: Added `title` to ClipRow's `ALLOWED_FIELDS` whitelist - previously title changes were silently ignored.
- **Library/Studio Save**: Refactored LibraryRow to use ClipRow's proven whitelist+diff pattern for consistent field saving.
- **Duplicate Positioning**: Fixed duplicate rows appearing at bottom of list instead of immediately after source row.
- **Prompt Builder (Nano)**: Fixed repeated Location/Action/Camera text being inserted for every reference image.
- **Aspect Ratio**: Generation now correctly uses Episode's `aspectRatio` setting instead of stale 16:9 default.
- **Video Refs in UV**: Fixed video reference images displaying blank in Universal Viewer (was hardcoded as `type: 'image'`).
- **UV Download**: Replaced new-tab download approach with fetch+blob - downloads now happen inline without opening/closing tabs.

---

## 2026-01-17: v0.23.0 - Osprey (Media Architecture)

### Context
A fundamental architectural shift for Media management. Media items are now first-class citizens directly linked to Episodes (`episodeId`), rather than just incidental attachments to Clips. This resolves all "orphaned media" issues and enables robust Reference Image management.

### Key Changes
- **Database Schema**: Added `episodeId` to `Media` model.
- **Single Source of Truth**: `Media` table is now the definitive source for all gallery and clip references; legacy CSV columns logic superseded.
- **Hardening**:
  - `unlink` logic now recursively cleans legacy Clip fields (`resultUrl`, `thumbnailPath`, `status`, `taskId`) to prevent "zombie" state.
  - Video thumbnail fallback added to prevent dark cards.
  - `add-ref` logic cleaned up to prevent "ghost" thumbnails when moving results.
- **UX**:
  - Unified Playlist: Clicking a Reference Image now builds a playlist that *includes* the Result, enabling seamless swiping.
  - Blank Preview Fix: `ClipRow` now correctly identifies Image results even when thumbnail path is missing.

---

## 2026-01-17: v0.22.1 - Osprey (Sideload Polish)

### Context
A polish release improving the velocity of the "Sideloading" workflow. References can now be created from results with a single click.

### Changes
- **UX**: "Add as Ref" button in Universal Viewer now immediately sideloads the result to the current clip if applicable, bypassing the dialog.
- **Version Bump**: 0.22.0 -> 0.22.1.

---

## 2026-01-17: v0.22.0 - Osprey (Persistence & Safety)

### Context
A massive UX and stability update addressing long-standing friction points in session management and data safety. Users can now trust their session state (Episode/Series selection) to persist across reloads, and the "Unlink" action is no longer destructive. Navigation flow is smoothed with click-to-view reference internal logic.

### Changes
- **Session Persistence**:
    - **LocalStorage**: Implemented robust saving/restoring of `currentSeriesId` and `currentEpisode` to browser storage.
    - **Race Condition Fix**: Added hydration guards to prevent default state values from overwriting saved sessions on page load.
- **Data Safety**:
    - **Safe Unlink**: Refactored the "Unlink" (`-`) action to detach `Media` records from clips via a new `/api/media/unlink` endpoint instead of deleting them. This fixes "Ghost Deletions" where items disappeared from the Media Gallery.
    - **Backwards Compatibility**: Maintains legacy CSV string updates while properly handling the relational DB link.
- **UX Refinements**:
    - **Ref Image Click**: Clicking a reference image thumbnail in the Episode view now opens the **Universal Media Viewer** in "Playlist Mode" (allowing swiping through all refs) instead of triggering the inline editor.
    - **Edit Mode Access**: Edit mode is still accessible by clicking the empty "Drop Zone" or other cell areas.
- **Version Bump**: 0.21.0 -> 0.22.0.
# Project History & Architecture Log

This document serves as a rolling historical record of what was implemented, why it was implemented, and the architectural decisions behind it.

## 2026-01-17: v0.21.0 - Harrier (Reference Grid & Data Stability)

### Context
Addressed critical stability issues with Nano model generation where results were failing to persist or display correctly. This release also significantly enhances the usability of the Reference Image workflow by expanding the display grid and ensuring the newest content is always prioritized.

### Changes
- **Reference Workflow**:
    - **3x3 Grid**: Expanded the Reference Image display in the Clip Table from a max of 3 items to a **3x3 Grid (9 items)**.
    - **Reverse Ordering**: The grid now prioritizes **Newest-First** (LIFO), meaning the most recently dropped image appears immediately at the top-left, enhancing the "Sideload" feedback loop.
- **Nano Stability**:
    - **Persistence Fix**: Resolved a bug in `generate-manager.ts` where the resolved model ID (e.g., `nano-banana-pro`) was not persisting to the database, causing the Polling Loop to misidentify the task type and fail to save the result.
    - **Data Recovery**: Retroactively fixed `Media` table entries for orphaned Nano clips.
- **Architecture**:
    - **Dual-Database Clarification**: Explicitly documented the separation between `dev.db` (Port 3000) and `prod.db` (Port 3001) to prevent confusion during debugging.
- **Version Bump**: 0.20.0 -> 0.21.0.

---

## 2026-01-17: v0.20.0 - Harrier (Image Manifest & Reference Workflow)

### Context
A significant feature release focused on the generation engine's image handling and the Universal Media Viewer's reference workflow. The Image Manifest Priority system was implemented to give explicit control over which images are sent to which model slots. The Add-as-Ref workflow was completely refactored to support moving (not duplicating) result images.

### Changes
- **Image Manifest Priority**:
    - **Model-Specific Limits**: Veo (3 images), Kling (1 image), S2E (2 images), Nano/Flux (8 images).
    - **Priority Order**: Style → Location → Characters → Ref Images.
    - **Ref Ordering**: Refs now prepend (latest first) for I2V start frame priority.
    - **Kling Single-Image**: Kling uses ONLY the first ref image (latest added).
- **Add-as-Ref Refactoring**:
    - **Result Images**: Single-click moves result to clip's refs (no dialog).
    - **Ref Images**: Opens dialog with **Copy** and **Move** options to another clip.
    - **No Duplicates**: Move operation now clears source clip's `resultUrl` and `thumbnailPath`.
    - **API Endpoints**: Created `/api/media/copy-ref` (duplicate) and updated `/api/media/add-ref` (move).
- **Universal Viewer Cleanup**:
    - Removed duplicate Airplay button.
    - Removed unused `onSideload` prop.
    - Added `ownerClipId` prop for direct result-to-ref moves.
- **Test Fixes**:
    - Fixed `editing.spec.ts` click target for Studio Library inline editing.
- **Version Bump**: 0.19.1 → 0.20.0.

---

## 2026-01-15: v0.19.1 - Falcon (Download Standardization)

### Context
A targeted patch release addressing user feedback regarding inconsistent download filenames across the application. Previous implementations relied on context-dependent titles which caused confusion. This update enforces a strict naming convention globally.

### Changes
- **Download Logic**:
    - **Standardization**: Updated `getClipFilename` to enforce `[SCENE] [CLIP] [VERSION]` format (e.g., `1.1 Roswell 2.png`).
    - **Global Viewer**: Patched `page.tsx` to use the standardized filename generator instead of ad-hoc title construction.
    - **Media Gallery**: Patched `/media/client.tsx` to resolve Series names dynamically and apply the same standardized filename logic to the Media Gallery viewer.
- **Version Bump**: 0.19.0 -> 0.19.1.

---

## 2026-01-14: v0.19.0 - Falcon (Studio Polish & Admin Tools)

### Context
A feature and polish release focused on improving the Studio user experience and adding administrative tools for developers. The Studio "Universal Media Viewer" was patched to correctly handle reference image states (unlinking vs deleting), and a direct database access button was added to the Settings page.

### Changes
- **Universal Media Viewer**:
    - **Icon Logic Fix**: Resolved a critical issue where Studio items displayed "Airplay" and "Trash" icons instead of the correct "Minus" (Unlink) icon.
    - **Root Cause**: Identified and fixed a global `UniversalMediaViewer` instance in `page.tsx` that was incorrectly flagging Library items as non-references.
    - **Result**: Studio Reference images now correctly allow unlinking without permanent deletion.
- **Admin Tools**:
    - **Database Access**: Added a stylized "Database Admin" banner to the Settings page with a direct link to open Prisma Studio (`localhost:5555`).
- **Version Bump**: 0.18.0 -> 0.19.0.

---
## 2026-01-12: v0.18.0 - Falcon (Legacy Deprecation)

### Context
A major architectural milestone deprecating the legacy CSV-based data storage for media references. The system has moved to a strict "Media-First" relational architecture, ensuring data integrity and enabling advanced features like Drag & Drop reordering and Sideloading. Legacy columns are now read-only fallbacks.

### Changes
- **Architecture**:
    - **Deprecation**: The legacy `Clip.refImageUrls` and `Clip.resultUrl` CSV columns are no longer written to.
    - **Media-First**: All frontend components (`ClipRow`) and backend services (`MediaService`, `api/clips`) now use the `Media` table as the single source of truth.
- **Features**:
    - **Drag & Drop Sideloading**: Users can now drag a **Result** image onto the **Reference** area to instantly sideload it as a reference for the next generation.
    - **Drag Sorting**: Reference thumbnails can be reordered or moved between clips via drag and drop.
    - **Optimistic UI**: Implemented instant UI updates (0ms latency) for these actions, with automatic rollback if the background API call fails.
- **Version Bump**: 0.17.2 -> 0.18.0.

---

## 2026-01-12: v0.17.2 - Falcon (Studio Alignment & Integrity)

### Context
A robust "Stability & Alignment" release verifying the integrity of Reference Images in both Episode and Studio workflows. Critical bugs involving "ghost deletions" (thumbs reappearing) and "invisible edits" (missing thumbs in Edit Mode) were resolved. We also aligned the Studio Toolbar with the Episode UI for consistency.

### Changes
- **Reference Image Integrity**:
    - **Dual-Write Architecture**: Restored "Dual-Write" logic in `MediaService` (`syncReferences` and `syncStudioReferences`) to explicitly sync the Legacy `refImageUrls` CSV column with the new `Media` table. This fixes the "reappearing thumb" glitch where the API returned stale data after deletion.
    - **Studio Sync**: Wired up the same robust sync logic for Studio Assets (`db.studioItem`), ensuring Library reliability.
- **Edit Mode Logic**:
    - **Location Thumbs**: Fixed regression where Location thumbnails disappeared in Edit Mode. Added logic to render the underlying `onResolveImage` preview for the Location field.
- **UI Refinements**:
    - **Toolbar Consistency**: Removed redundant "Chevron" icons from all Dropdowns in Episode and Studio toolbars for a cleaner, flatter aesthetic.
    - **Studio Styling**: Updated Studio Toolbar "Style" control width to 150px to match the Episode screen.
- **Version Bump**: 0.17.1 -> 0.17.2.

---

## 2026-01-11: v0.17.1 - Falcon (Media Viewer & Interaction Polish)

### Context
A targeted polish release focusing on the "Universal Media Viewer" and editing workflows. Users reported issues with download filenames, reference image visibility in Edit Mode, and z-index conflicts obscuring dialogs. This release resolves these interaction friction points.

### Changes
- **Universal Media Viewer**:
    - **Navigation**: Fixed playlist logic to strictly include ALL reference images (Explicit + Auto-Resolved + Legacy), ensuring navigation arrows appear correctly even for "1 Result + 1 Ref" scenarios.
    - **Z-Index Hardening**: Boosted `AlertDialog` (Delete Confirmation) to `z-[10000]` to ensure it always renders above the high-z `UniversalMediaViewer` (`z-[9999]`).
    - **Sideload Safety**: Fixed logic to correctly **append** Sideloaded references to the existing list instead of overwriting them.
- **Data Integrity & Editing**:
    - **Ref Image Editing**: Fixed bug where Edit Mode ("thumbs") appeared empty. The editor now correctly initializes with the full "Hybrid" list of references seen in Display Mode.
    - **Delete Sync**: Deleting a reference thumbnail in Edit Mode now correctly syncs the removal to both `explicitRefUrls` and `refImageUrls` persistence fields.
- **Downloads**:
    - **Filenames**: Enforced strict `[SCENE] [TITLE] [VER].ext` naming convention for downloaded clips.
    - **Robustness**: Added auto-extension detection (e.g., adding `.mp4` if missing) and relaxed sanitization to allow spaces and brackets, fixing "Missing Filename" bugs.
    - **Browser Safety**: Forced downloads to open in a `_blank` new tab to prevent main window freezing.
- **Version Bump**: 0.17.0 -> 0.17.1.

---

## 2026-01-11: v0.17.0 - Falcon (Stability & Precision)

### Context
This milestone release consolidates a week of intensive "Hotfix & Polish" cycles (v0.16.4 - v0.16.9) into a stable production baseline. The focus was entirely on **Data Integrity**, **Visibility**, and **Model Reliability**. We resolved critical bugs where reference images disappeared, results were overwritten, and prompts caused API crashes.

### Key Features & Fixes (Rollup)

#### 1. Data Integrity Firewall (v0.16.5)
- **Problem**: Saving a Clip Row (text edit) after a background generation finished would overwrite the new `resultUrl` with the stale `resultUrl` from the editor start.
- **Solution**: Implemented a **Double-Lock Mechanism**:
    - **Frontend**: Strict Whitelist in `ClipRow` editor prevents system fields (`resultUrl`, `status`) from being sent.
    - **Backend**: API Firewall in `/update_clip` strictly sanitizes incoming payloads, rejecting any write attempts to protected fields.

#### 2. Kling 2.6 "Explicit Priority" (v0.16.8)
- **Problem**: Users couldn't "override" a Character bio image with a specific manual reference image for a single shot without deleting the bio.
- **Solution**: Updated `PayloadBuilderKling`. If a **Manual Reference Image** is present, it now **strictly prioritizes** that image, ignoring all bio-derived images.

#### 3. Smart Visibility Logic (v0.16.7)
- **Problem**: Reference images appeared to "disappear" if they matched a Character thumb, or were duplicated, confusing users.
- **Solution**: Implemented **Hybrid Visibility**:
    - **Manual Adds**: Always shown (even if duplicate).
    - **Legacy Data**: Filtered to remove duplicates.

#### 4. API Stability
- **Prompt Truncation (v0.16.9)**: Added 2000-char safety limit to Kling payloads to prevent `500 Text too long` errors.
- **Resolver Logic (v0.16.4)**: Hardened `resolveClipImages` to strictly prefer explicit user inputs over library lookups.

#### 5. User Experience
- **Download vs Archive**: Changed "Save" buttons in Video Player/Modal to standard **OS Download** behavior.
- **Ref Persistence**: Fixed bug where editing a row wiped its reference images.

### Version Bump
- **Minor**: 0.16.3 -> 0.17.0.

---

## 2026-01-11: v0.16.3 - Phoenix Stability (Save Logic & Polling)

### Context
Addressed critical user feedback regarding data integrity. Users reported that "saving" a clip often wiped its reference images or reverted the result preview. This was traced to destructive client-side filtering and a logic mismatch in the "Save" button expectation (Archive vs Download).

### Changes
- **Save Button Refactor**:
    - **UX Alignment**: Changed the Green "Save" button in both `MediaPreviewModal` and `VideoPlayerOverlay` to perform a **Download to Computer** action (OS Dialog).
    - **Logic**: Removed the potentially destructive `archiveMedia` hooks from these buttons to prevent accidental modification of backend reference data.
- **Data Integrity**:
    - **State Corruption Fix**: Patched `src/app/page.tsx` to prevent `onSave` from overwriting authoritative "Explicit" references with "Resolved" references, which was causing implicit data pollution.
    - **Non-Destructive Filtering**: Updated `ClipRow` to filter duplicate thumbnails *visually* in the UI only, while preserving the raw data in the Editor to prevent accidental deletion during saves.
- **Polling Robustness**:
    - **Result Ordering**: Refactored `api/poll/route.ts` to use robust array manipulation for prepending new results. This ensures the latest generation always appears first in the CSV list, fixing the "Reverted to Previous" preview bug.
- **Version Bump**: 0.16.2 -> 0.16.3.

## 2026-01-09: v0.16.2 - Phoenix Stability (Nano Polling)

### Context
Resolved a critical "Infinite Generating" loop for Nano models where the polling architecture failed to retrieve the result URL due to missing model persistence. This release cements the robustness of the polling system with regression testing.

### Changes
- **Polling Architecture**:
    - **Logic Fix**: Backend route now correctly respects "Generating" status instead of converting it to "Error" prematurely.
    - **Model Persistence**: updated `GenerateManager` to strictly persist `model` ("nano-banana-pro") to the database, ensuring correct polling strategy selection.
    - **Smart Merge**: Frontend now intelligently merges polled data to prevent "Zombie" task detection from killing valid (but slow-to-sync) tasks.
- **Testing**:
    - **Regression**: Added `scripts/test-integrity.ts` to verify database persistence of generation payloads.
    - **Mocking**: Added `MOCK_KIE` support to `src/lib/kie.ts` for cost-free integration testing.
- **Version Bump**: 0.16.1 -> 0.16.2.

## 2026-01-08: v0.16.1 - Phoenix Robustness (Spinner Fix)

### Context
A critical polish release addressing a "Spinner Flicker" bug where transient API behavior caused the generation UI to stall prematurely.

### Changes
- **Polling Robustness**:
    - **Anti-Flicker**: Patched `usePolling` with a grace period for new tasks (count > 1) to prevent "Zero Task ID" race conditions from triggering aggressive resets.
    - **Logic**: Poller now ignores "Generating but no ID" state during the initial 10-15s upload window.
- **Payload Logic**:
    - **Style**: Verified and fixed logic where "Text Only" styles (no reference image) correctly suppress the automatic "Defined by IMAGE X" header.
- **Documentation**:
    - **Backlog**: Archived completed v0.16.0 items.
    - **Manual**: Updated notes on Style Description data hygiene.
- **Version Bump**: 0.16.0 -> 0.16.1.

## 2026-01-06: v0.16.0 - Griffin (Veo S2E & Polling Robustness)

### Context
Release "Griffin" delivers the long-awaited "Start-to-End" (S2E) generation for Veo, effectively enabling Image-to-Video workflows with precise start/end frames. This release also includes a critical hardening of the polling infrastructure and significant UI polish.

### Changes
- **Veo S2E (Start-to-End)**:
    - **Implementation**: Enabled `IMAGE_TO_VIDEO` generation type using Image 1 (Start) and Image 2 (End).
    - **Robustness**: Added automatic fallback logic (if <2 images, fall back to Reference-2-Video or Text-2-Video) to prevent payload failures.
- **Robust Polling Infrastructure**:
    - **Zombie Killer**: Refined `usePolling` hook to intelligently kill "Zombie" tasks (Generating without Task ID) after 45s, while protecting long-running legitimate tasks.
    - **Error Persistence**: Caught polling errors (404/500) are now persisted to the DB as `Error` status, preventing indefinite UI spinning.
    - **Defensive Strategy**: Refactored `Veo`, `Flux`, and `Nano` strategies to handle inconsistent API responses (numeric statuses, varying result URL keys) without crashing.
- **UI Polish**:
    - **Video Player Overlay**: Moved "Save Reference Image" to top toolbar (orange icon), added tooltips, and restricted visibility to Images only.
    - **Style Control**: Fixed floating tooltip artifact in the Action Toolbar.
    - **Labels**: Renamed "Veo S2E" model label for clarity.

## 2026-01-05: v0.15.1 - Phoenix Polish (Overlay Restoration)

### Context
A fast-follow release to v0.15.0 restoring critical video playback controls and refining the UI based on user feedback. The Overlay controls (Download/Cancel) were previously missing or misaligned.

### Changes
- **Video Player Overlay**:
    - **Controls**: Restored "Download" and "Close" buttons.
    - **UI Refinements**:
        - Moved controls to Top-Right of the video viewport.
        - Styled as minimalist Orange icons (Warning style) for visibility.
        - Removed "Auto-Close" behavior to allow reviewing the final frame.
    - **Edit Mode**: Aligned the "Save" button to the top of the edit field for better ergonomics.
- **Bug Fixes**:
    - **React Hooks**: Fixed `Rendered more hooks than during the previous render` crash in `VideoPlayerOverlay`.
    - **URL Matching**: Fixed bug where comma-separated URLs (e.g., `url1,url2`) failed to match the single playing URL, breaking the Edit/Save linkage.

## 2026-01-04: v0.15.0 - Phoenix Refactor (The De-Monolith)

### Context
A massive architectural overhaul ("De-Monolith") to separate the application's Data Layer (Brain) from its UI (Body), alongside a comprehensive hardening of the Test Suite.

### Changes
- **Architecture**:
    - **Brain/Body Separation**: Extracted `useDataStore` (Zustand) to manage state outside of React components.
    - **Modularization**: Split `page.tsx` monolith into focused components (`ClipTable`, `ActionToolbar`, `Dialogs`).
    - **Type Safety**: Unified `Clip`, `Series`, `Episode` types into a shared definition.
- **Reliability & Testing**:
    - **Green Suite**: Achieved fully passing regression tests (`editing`, `rendering`, `logic`) by implementing `data-testid` selectors and robust mocking.
    - **E2E Hardening**: Fixed race conditions and improved selector stability in Playwright tests.
- **UX Polish**:
    - **Style Menu**: Reinstated "Clear Style" (X) button with improved layout.
    - **Visuals**: Aligned toolbars, fixed spacing issues.

## 2025-12-20: v0.7.2 - Reactive Studio & Agent Foundations

### Context
Addressed user feedback regarding the "Studio" (Library) reactivity. Previously, updating a character/location image didn't immediately reflect in the Clips table. Also laying groundwork for Agentic testing.

### Changes
- **Studio Reactivity**: Implemented "Beacon" logging and improved `resolveClipImages` logic to ensure clip thumbnails update instantly when their linked Studio Asset is modified.
- **Agent Test Migration**: Added `AgentMigrationTest` table (via Prisma) to validate migration workflows.
- **Version Bump**: 0.7.1 -> 0.7.2.

## 2025-12-18: Local Dev/Prod Isolation

### Context
We needed a way to develop new features (like Drag and Drop) without risking stability or data corruption in the "Production" version of the app that is currently in use. Since this is a single-user local application, sophisticated cloud infrastructure (VPS, Docker) was deemed unnecessary.

### Decision
We adopted a "Local Dual-Environment" strategy:
- **Development**: Runs on Port `3000`. Connects to `prisma/dev.db`.
- **Production**: Runs on Port `3001`. Connects to `prisma/prod.db`.

### Implementation Details
1.  **Database Separation**: The SQLite database was duplicated. `dev.db` is for experimentation, `prod.db` is for stable usage.
2.  **Environment Config**: Created `.env.development` and `.env.production` to automatically switch the `DATABASE_URL` based on the context.
3.  **Process Management**: 
    - `npm run dev` -> Development (Unstable)
    - `npm run start` -> Production (Stable, Port 3001)
4.  **Artifact Isolation**: Configured `next.config.js` to use `.next-dev` for Development build artifacts, preventing interference with the Production `.next` folder.

### Guardrails
- Moving features from Dev to Prod requires a build and a structured database migration (`npx prisma migrate deploy`).

---

## 2025-12-16: Generate Manager Audit & Fixes

### Context
Users reported regressions in Veo payload generation, specifically regarding `imageUrls` (array) vs `imageUrl` (singular) and deprecated model IDs (`veo3_fast`).

### Decision
A "Golden Master" audit was conducted to align the code strictly with the verified Kie.ai CURL specification.

### Implementation Details
- **Strict Typing**: Updated `src/lib/kie-types.ts` to remove permissive array types.
- **Refactor**: Removed hardcoded `veo3_fast` overrides in `src/lib/generate-manager.ts`.
- **Payload Alignment**: Enforced singular `imageUrl` for Veo-2 compatibility.
- **Reference**: [Generate Manager Review](architecture/generate-manager-review.md)

## 2025-12-16: Architecture Review - Golden Master

### Context
A broad review of the system's adherence to external API specifications.

### Findings
- Identified drift between the "Golden Master" spec (simple) and implementation (legacy complexity).
- Confirmed that `api/generate-library` was clean and compliant.
- **Reference**: [General Review](architecture/general-review.md)

## 2025-12-21: v0.7.3 - New Series Process Hardening

### Context
Addressed critical robustness issues in the "New Series" creation flow. Previously, network errors or duplicate names would cause the dialog to close immediately, resulting in data loss and confusing user experience.

### Changes
- **Robustness**: Implemented strict validation and proper HTTP error codes (409 Conflict) for duplicate series names.
- **Async Handling**: Updated the parent-child component communication to be fully async, allowing the UI to wait for server confirmation.
- **UI Polish**: Added loading states (spinners) and inline error messages (no more alerts). Also refined the Add Series dialog spacing to match the design system.
- **Version Bump**: 0.7.3 -> 0.8.0.

## 2025-12-23: v0.8.0 - Feature Pack: Duplication, Fast Delete, & UI Polish

### Context
This major release focuses on workflow velocity and visual refinement. Users needed faster ways to build scenes (duplication) and a more responsive deletion experience. We also performed a comprehensive "Style & Stability" pass to fix long-standing UI quirks.

### Features
- **Duplicate Support**:
    - **Clips**: Added "Duplicate" (+) action with smart scene incrementing (`1.1` -> `1.2`) and "Midpoint" sorting.
    - **Library**: Added duplication for Characters/Locations to speed up asset creation.
- **New Asset Workflows**:
    - **New Scene**: Added top-level "Add" button for quick scene creation.
    - **New Studio Item**: Added "New Item" button to the Library view.
- **Tombstone Deletion**:
    - **Clips**: Implemented client-side "Tombstones" for instant visual removal of deleted items. This makes the UI feel 10x faster even while the API delete runs in background.

### UI & Architecture Refinements
- **Global Z-Index Hardening**: Lifted `PageHeader` and `RowActions` (`z-50`) to prevent overlay blocking.
- **Button System Upgrade**:
    - Migrated global color variables to **HSL** to fix opacity bugs.
    - Standardized all `outline` buttons to use `border-black` for visibility.
- **Location Menu Fix**: Replaced custom autocomplete with a robust **Dropdown Button**.
- **Environment Findings**: Confirmed "Hover" issues on M4 Macs are browser-level behavior.

## 2025-12-23: v0.8.1 - UI Polish & Renumbering

### Context
A refine-and-polish release following v0.8.0, focusing on Action Toolbar usability and interface consistency.

### Changes
- **Smart Renumbering**: Added "Location-Sensitive" renumbering to the Action Toolbar.
    - Increments Scene (1.01 -> 2.01) when Location changes.
    - Includes `Loader2` spinner state.
    - Updated backend API (`/api/renumber`) to handle UUIDs/Integers robustly.
- **Batch Dialog**: Added confirmation step and "singular/plural" grammar logic for model generation.
- **Action Toolbar Layout**:
    - Standardization: Strict 16px (`gap-4`) spacing.
    - Dividers: Removed uneven margins for perfect symmetry.
- **Visual Polish**:
    - Updated Page Header titles to "Grey / White" hierarchy.
    - Restored material icons for Generate button.
- **Version Bump**: 0.8.0 -> 0.8.1.

## 2025-12-24: v0.9.0 - Series Page Overhaul

### Context
A significant UX overhaul for the Series Page to streamline episode management and improve visual consistency. Users needed faster ways to create, rename, and edit episodes without navigating away from the list view.

### Features
- **Series Renaming**:
    - Added inline editing to the Series Page header.
    - Hover-to-edit pencil icon with Save/Cancel controls.
- **New Episode Workflow**:
    - Introduced a dedicated "NEW EPISODE" button in the header.
    - Implemented a modal dialog for creating episodes with Title and Number.
- **Inline Episode Editing**:
    - Clicking an episode number now activates "Row Edit Mode".
    - Allows direct modification of Title and Episode Number.
    - Replaced text buttons with square, outlined Icon Buttons (Check/X) using `outline-success` and `outline-destructive` variants for consistency.

### UI Refinements
- **Header Standardization**: Renamed "Series" to "Episodes" in the page header.
- **Table Styling**: Updated table headers to standard uppercase/stone style.
- **Visual Cleanup**: Removed redundant side panel titles and unified background colors.
- **Version Bump**: 0.8.1 -> 0.9.0.

## 2025-12-24: Storyboard & Frontend Architecture Review

### Context
Implemented the Storyboard view to provide a visual timeline of scenes. Following this, a focused architectural review of the frontend was conducted to identify technical debt and future refactoring needs.

### Features (Storyboard)
- **Visual Grid**: 4-column layout for scene visualization.
- **Print Optimization**: Global styles to strip UI chrome for clean PDF exports.
- **Visibility Toggle**: "Soft hide" for clips (greyed out in UI, hidden in Print).

### Architectural Review Findings
A deep-dive into the stack structure revealed specific areas for improvement:
- **Monolith Component**: `page.tsx` (>1600 lines) needs splitting into View components.
- **State Management**: Complex `useState` trees should move to Zustand or Context.

### Print Layout Refinements
- **Native Browser Control**: Removed custom "Table Hacks" to allow cleaner browser margin management.
- **Dual Layout Modes**:
    - **Landscape**: Standard 3x2 Grid for high-fidelity thumbnails.
    - **Portrait**: Specialized "Row Layout" (Image | Scene | Action | Dialog) for high-density lists (6 per page).
- **Screen Decoupling**: Ensured changing Print Layout settings does not break the on-screen UI.
- **Precision Margins**: Fine-tuned to 14mm Top, 9mm Sides, 0 Bottom with specific header spacing.
- **State Management**: Current `useAppStore` hook causes excessive re-renders; recommendation to move to Zustand.
- **Type Definitions**: Shared types (`Clip`, `Series`) are currently co-located in API routes, creating circular dependencies.

### Reference
- [Full Stack Review & Recommendations](architecture/full_stack_review_and_recommendations.md)

## 2025-12-26: v0.10.0 - Storyboard v1 & Universal Media Preview

### Context
This milestone release introduces the **Storyboard View** for visual storytelling and significantly upgrades the media handling architecture. It also solidifies the Print Workflow to support professional PDF exports.

### Features
- **Storyboard View**:
    - A dedicated visual timeline for managing scenes.
    - **Print Layout Engine**: Robust "Portrait 6x1" and "Landscape 3x2" modes with precision 14mm/9mm margins.
    - **Visibility Controls**: Soft-hide clips from print without deleting them.
- **Universal Media Preview**:
    - **Smart Modals**: Centralized standard for viewing media. clicking a thumbnail now opens a high-fidelity Modal (Player for Video, Lightbox for Image).
    - **Content Awareness**: The UI correctly identifies Video vs Image content even when displaying a fallback thumbnail.
- **Backend Robustness**:
    - **Defensive Thumbnailing**: Integrated `generateThumbnail` directly into the polling loop to ensure no "Missing Thumbnail" states occur after jobs complete.
    - **Safe-Fail Logic**: Processing errors are logged but do not block result URL saving.

### Architecture
- **Refactor**: Decoupled `MediaDisplay` from ad-hoc `window.open` calls to a self-contained component using `MediaPreviewModal`.
- **Docs**: Updated [Walkthrough](walkthrough.md) and [Full Stack Review](architecture/full_stack_review_and_recommendations.md).
- **Version Bump**: 0.9.0 -> 0.10.0.

## 2025-12-30: v0.11.0 - Flux Generation & Environment Hardening

### Context
Completed a major epic to integrate the "Flux" image generation model into the Studio library workflow, prioritizing high-quality "cinematic" output and smart style referencing. During this process, we identified and resolved critical environmental instabilities caused by ghost server processes.

### Features
- **Flux Model Integration**:
    - **Smart Model Selection**: Automatically switches between `flex-text-to-image` and `flex-image-to-image` based on input availability.
    - **Style Injection**: Automatically resolves and injects "Style" descriptions and reference images into the prompt pipeline.
    - **Local Persistence**: Full-resolution images are now downloaded and stored locally (`public/media/library`) to prevent link expiry.
- **Library UI Improvements**:
    - **Status Alignment**: Moved generation status/error text to the "Row Actions" column (beneath buttons) to match the Clip table layout.
    - **Input Sanitization**: Implemented "Nuclear" protection to prevent error dumps/debug text from rendering in the image input field.

### Environmental Hardening (DevOps)
- **Anti-Ghosting**: `npm run dev` now automatically kills any process on Port 3000 before starting.
- **Auto-Sync**: `npm run dev` now automatically runs `npx prisma generate` to prevent database schema mismatches.
- **Logging Hygiene**: Enforced strict `no-console` linting rules to keep production logs clean.

### Version Bump
- **Core**: 0.10.0 -> 0.11.0.

## 2025-12-31: v0.12.0 - Persistence & Robustness

### Context
A critical robustness release addressing regression in "Broken Icons" and Studio State Persistence. Also finalized the "Flux" optimization with tuned parameters for high-fidelity generation.

### Changes
- **Downloads Architecture**:
    - **Proxy Stream**: Replaced Blob downloading with a direct `Content-Disposition` stream to prevent OOM on large files.
    - **Security**: Added strict filename sanitization on both client and server proxies.
- **Persistence & State**:
    - **Race Condition Fix**: Solved a critical bug where Studio settings (Seed, Style, Guidance) reset on page load.
    - **Local State**: Now correctly persists `seed`, `currentEpisode`, and `currentSeriesId` to `localStorage`.
- **Flux Optimization**:
    - **Guidance Tuning**: Mapped UI (1-10) to API (1.5-10.0) for full control range.
    - **Prompt Engineering**: Added specific "Style Reference" weights `(text:1.3)` to the Flux payload.
    - **Bug Fixes**: Whitelisted `/media/` paths to fix broken previews for locally generated images.
- **Version Bump**: 0.11.0 -> 0.12.0.

## 2025-12-31: v0.12.1 - UI Polish & Hotfixes

### Context
A follow-up patch to v0.12.0 addressing visual regressions in the Studio Edit mode and refining the Media Preview experience.

### Changes
- **Bug Fixes**:
    - **Edit Mode Thumbnails**: Whitelisted `/media/` paths in `ImageUploadCell` to correctly display locally persisted images during editing (previously showed "Err").
- **UI Refinements**:
    - **Preview Modal**: Removed duplicate "Close" (X) icon caused by default Dialog behavior.
    - **Styling**: Standardized Preview Modal buttons (Download/Close) to uniform size and Orange branding for better visibility.
- **Version Bump**: 0.12.0 -> 0.12.1.

## 2025-12-31: v0.12.2 - Database Synchronization

### Context
This patch resolves a schema drift issue encountered after migrating the Production database to the Development environment. The older Production database lacked the `thumbnailPath` column in the `StudioItem` table, causing application crashes.

### Changes
- **Database**: 
    - Migrated Production data to Development environment (`prod.db` -> `dev.db`).
    - Forced schema synchronization (`prisma db push`) to add the missing `thumbnailPath` column.
    - Cleared stale database locks caused by zombie processes.
- **Version Bump**: 0.12.1 -> 0.12.2.

## 2025-12-31: v0.12.3 - Studio UI Polish

### Context
Refined the Studio (Library) Screen UI to match the aesthetic and layout of the Episode Screen, creating a more consistent user experience across the application.

### Changes
- **Action Toolbar Alignment**:
    - **Buttons**: Converted "Generate" and "Download" to compact, square icon-only buttons (matching Episode view), reducing visual clutter.
    - **Labels**: Aligned header labelling. Left side now displays "Studio | {N} Assets". Right side displays "{N} SELECTED" count.
    - **Layout**: Removed vertical dividers between Style, Guidance, and Seed controls for a cleaner, grouped appearance.
- **Version Bump**: 0.12.2 -> 0.12.3.

## 2026-01-01: v0.13.0 - Studio Persistence & Confidence
### Context
Addressed critical usability gaps in the Studio (Library) workflow. Users reported that style/guidance settings were not sticking, and accidental credit usage was common due to lack of confirmation.
### Features
- **Studio Persistence**:
    - **Reactivity**: Fixed bug where "Style" selection was ignored due to dependency on transient UUIDs. Now uses robust Series/Episode ID matching.
    - **Sync**: Implemented bidirectional synchronization of Style, Guidance, Seed, and Aspect Ratio between Studio and Episode views.
    - **View Support**: Added "VIEW" (Aspect Ratio) control to Studio toolbar, persisting correctly to all generations.
- **Confidence Dialog**:
    - **Confirmation**: Added a "Generate" confirmation dialog in Studio.
    - **Summary**: Displays precise settings (View, Style, Strength, Seed) before commit.
- **UI Refinements**:
    - **Clarity**: Renamed "Guidance" -> "STRENGTH" for better user understanding.
    - **Seed Control**: Narrowed seed input to loosely suggest 4-digit localized usage; changed placeholder to "Auto".
### Version Bump
- **Minor**: 0.12.3 -> 0.13.0.
- **Commit**: `[Short Hash]`

## v0.24.0 (Peregrine) - 2026-01-24
**Focus**: Infrastructure Stability & Persistence Fixes

### 🛠️ Infrastructure
- **PM2 Migration**: Replaced fragile shell scripts with PM2 Process Manager.
    - **Dev**: Port 3000 (Managed).
    - **Prod**: Port 3001 (Managed, Background).
    - **Benefits**: Auto-restart, centralized logs, zero zombie processes.
- **Database Rescue**: Fixed critical "Readonly Database" error in Production by migrating to `prod_v2.db` and stripping system lock attributes.
- **Docs**: Updated `PLAYBOOK.md` with Master System Context & Operations Manual.

### 🐛 Bug Fixes
- **Camera Persistence**: Fixed critical bug where `camera` and `style` fields were silently dropped on save.
- **Location Persistence**: Investigated and resolved Production-specific caching issues causing optimistic UI reverts.
- **Server Restart**: Fixed broken deployment pipeline (`restart-stack.sh` now updated and verified).

## 2026-01-02: v0.14.0 - Payload Hardening & UI Polish

### Context
Major refinement of the Flux generation payload to strictly control style transfer intensity. Implemented specific user-requested prompt structures ("Negatives", "ABSOLUTE STYLE SOURCE") and hardcoded weightings. Also addressed UI spacing issues.

### Features
- **Payload Optimization**: 
    - **Integrated "Negatives" support in both Style and Subject prompt blocks.
    - Implemented authoritative "ABSOLUTE STYLE SOURCE" system headers.
    - Hardcoded "Facial proportions: 200%" into the instruction footer.
- **UI Polish**:
    - **Studio Toolbar**: Fixed spacing between count and label in "Selected Items" display.

### Technical
- **Schema**: Leveraged `negatives` field in `StudioItem`.
- **Backend**: Updated `generate-library` route and `PayloadBuilderFlux` to support detailed negative prompts and strictly formatted templates.
- **Version Bump**: 0.13.0 -> 0.14.0.

## 2026-01-03: v0.14.1 - Stability & Downloads

### Context
Addressed critical regressions in Studio generation and Download functionality discovered during end-user testing. The previous "Proxy Download" approach was failing for local files on specific OS configurations.

### Changes
- **Downloads Refactor**: 
    - Implemented a "Hybrid" download strategy:
        - **Local Files**: Uses direct `<a>` tags with `download` attribute for instant, native saving.
        - **Remote Files**: Uses the Proxy route for cross-origin targets.
    - **Fix**: Resolved "No File" error when downloading generated assets.
    - **Fix**: Parsed CSV URLs correctly.
- **Studio Reactivity**:
    - **Model Selection**: Implemented "Just-in-Time" resolution for Studio generation. Bypassed React state lag to ensure the Generation Dialog always uses the accurate Series Default Model.
    - **Uploads**: New images are now prepended (not appended) to the list for immediate visibility.
- **Version Bump**: 0.14.0 -> 0.14.1.

## 2026-01-03: v0.14.2 - Veo Logic & Persistence

### Context
Fixed a critical logic bug where Veo generations were silently clamped to a single reference image, breaking multi-image style transfer. Also implemented the requested Nano-style prompt logic for Veo, restored the preferred Confirmation Dialog, and standardized download filenames.

### Changes
- **Veo Multi-Image Fix**: Updated `GenerateManager` to allow `all` images for Veo task types, enabling "Style Reference" workflows.
- **Veo Prompt Logic**: Ported `Nano` builder logic (Dynamic Numbering, Style/Subject blocks, Negatives) to `PayloadBuilderVeo`.
- **Dialog Restoration**: Restored the `page.tsx` controlled Confirmation Dialog for clip generation.
- **Download Filenames**: Enforced `[SERIES].[EP] [NAME] [VERSION]` format for all clip downloads.
- **Robustness**: Added automatic URL encoding in `GenerateManager` to handle filenames with spaces.
- **Version Bump**: 0.14.1 -> 0.14.2.

---

## 2026-01-14: v0.18.1 - Nano Stability Fix (Legacy & Logging)

### Context
A critical debugging release addressing the "Studio Spinner of Death" when generating Nano items. The issue was twofold: massive log payloads causing server hangs, and incorrect API parameter assumptions.

### Changes
- **Server Stability**:
    - **Log Truncation**: Modified `kieFetch` strategy to truncate excessively large legacy Base64 strings (image data) from debug logs. This prevents Node.js process hangs during upload.
- **Nano Compliance**:
    - **Format Revert**: Reverted `output_format` from `"mp4"` back to `"png"`. The Kie.ai API strictly enforces `"png"` for Nano payloads and returns a 500 error for `"mp4"`, regardless of the intended media type.
- **Version Bump**: 0.18.0 -> 0.18.1.
