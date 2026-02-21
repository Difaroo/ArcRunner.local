# Sprint Archive: v0.31.6 (Peregrine Hotfix)

## BEM Layout Persistence
- [x] Investigate failure of `autoSaveId` persistence across modal opens in `BatchEditModalV3.tsx`.
- [x] Analyze `react-resizable-panels` source code and test `onLayout` / `onResize` hooks.
- [x] Identify library failure: React events swallowed unreliably during portal mount phase.
- [x] Write native DOM `MutationObserver` to constantly track dynamic `flex-grow` coordinates of the `bem-top-panel` and serialize them safely into `sessionStorage`.
- [x] Verify persistence loop with visual browser subagent test: dragging retains proportions effectively across remount boundaries.
