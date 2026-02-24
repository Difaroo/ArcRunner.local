# ArcRunner - Post-Restart Context Recovery

## Previous State Summary
- **Accomplished**:
  - Restored Universal Media Viewer (UVM) permanent delete functionality.
  - Fixed Batch Edit Modal (BEM) Vibe creation live-refresh.
  - Implemented the Traffic Light Global Filter and row-level visual grab bar styling.
  - Resolved `thumbnailPath` Prisma schema mismatch safely in Prod/Dev using `db push`.
- **Current Mission**:
  - Investigating a series of new bugs discovered following the "Mega Refactor" (UVM harmonization and local/prod environment split).

## Files to Review Upon Resume
To quickly regain context on the UI state and data flow, review:
1. `src/app/page.tsx` (Contains global state, activeClips, bulk handlers)
2. `src/components/clips/BatchEditModalV3.tsx` (BEM UI and state)
3. `src/components/clips/UniversalMediaViewer.tsx` (UVM UI and delete logic)
4. `src/components/clips/ClipRow.tsx` and `ClipTable.tsx` (Recent traffic light changes)
5. *Any specific files the user mentions are related to the new bugs.*
