# Sprint v0.14 - v0.15: The "De-Monolith" Refactor & Testability

## Goal
Execute a controlled architectural refactor ("De-Monolith") to separate Data Logic (Brain) from UI (Body), and implement a robust "Green" regression test suite.

## Completed Tasks
- [x] **Architecture Refactor**:
    - [x] Extracted `useDataStore` (Zustand) for central state management.
    - [x] Modularized UI components (`ClipTable`, `ActionToolbar`, `Dialogs`).
    - [x] Ported all API routes and verified data integrity.
- [x] **Testability**:
    - [x] Implemented `data-testid` strategy across key components.
    - [x] Refactored `editing.spec.ts` and `rendering.spec.ts` for robustness.
    - [x] Mocked API calls in tests to ensure independence.
- [x] **Features & Polish**:
    - [x] Restored "Style Clear (X)" button in Toolbar.
    - [x] Cleaned up Layout and Spacing.
    - [x] Unified "Phoenix" Release.

## Status: COMPLETED
**Date**: 2026-01-04
**Version**: v0.15.0
