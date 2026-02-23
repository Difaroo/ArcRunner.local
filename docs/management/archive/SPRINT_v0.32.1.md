# Sprint Archive: v0.32.1 (Kestrel Update)
**Date Completed:** 2026-02-23
**Version Trigger:** `v0.32.1`

## Epic Overview
This sprint focused on hardening the workflows established in v0.32.0. The primary deliverable was a new global filtering mechanism for the Episode Clips table, allowing users to isolate clips by their functional status (Pending/Ready/Generating) via a Traffic Light UI, and immediately select that batch for processing. Secondary deliverables included restoring legacy features to the Universal Media Viewer and patching state drift in the Batch Edit Modal component.

## Completed Tasks
- [x] **Global Traffic Filter**: Added cycle UI to Clips Table header to isolate rows by Red/Orange/Green ready state.
- [x] **Bulk Selection**: Selecting a Traffic Light state auto-checks all matching rows.
- [x] **Grab Bar Indicators**: Replaced row-level status dots with edge-to-edge colored margins on the drag handles.
- [x] **BEM Vibe Refresh**: Fixed bug where creating a new Action Vibe failed to re-render the side menu.
- [x] **UVM Legacy Restore**: Restored the permanent delete Trashcan icon to the Universal Media Viewer overlay.

## Architectural Notes
- The standalone "Traffic Light" rendering dot on individual rows (`ClipRow.tsx`) was sunset in favor of styling the existing drag handle.
- The global table filter (`ClipTable.tsx`) hooks directly into the React-managed `selectedIds` state via an optimistic bulk-update loop over `handleSave` in `page.tsx`.
