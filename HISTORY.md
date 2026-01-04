# Project History

## v0.15.0 - 2026-01-04
**The Architecture Refactor**

### Major Changes
*   **De-Monolith**: Split `page.tsx` (~2000 lines) into modular views:
    *   `src/components/series/SeriesView.tsx`
    *   `src/components/clips/EpisodeView.tsx`
    *   `src/components/library/LibraryView.tsx`
    *   `src/components/storyboard/StoryboardView.tsx`
*   **State Management**: Migrated from `useState` prop-drilling to **Zustand** global store (`src/store/useStore.ts`).
*   **Types**: Centralized shared interfaces in `src/types/index.ts`.
*   **Performance**: Implemented `React.memo` for `ClipRow` to prevent unnecessary re-renders.

### Documentation
*   **User Manual**: Added comprehensive `USER_MANUAL.md` covering all workflows and system intelligence.
*   **Architecture**: Added `HIGH_LEVEL_ARCH.md`.

---
