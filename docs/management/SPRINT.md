# Sprint v0.16.0: Griffin (Veo S2E)

## Goal
Implement "Veo S2E" (Start-to-End) video generation, allowing users to define start and end frames using Reference Images 1 and 2.

## Active Tasks
- [x] **UI Implementation**
    - [x] Add "Veo S2E" to `ActionToolbar` Model Menu.
    - [x] Ensure consistent "Bird" naming in internal docs.
- [x] **Payload Logic**
    - [x] Update `PayloadBuilderVeo.ts` to handle `veo-s2e` model ID.
    - [x] Implement `IMAGE_TO_VIDEO` generation type logic.
    - [x] Validate 2-image requirement (Start/End).
- [x] **Verification**
    - [x] Verify fallback to Text-to-Video if images missing.
    - [x] Verify correct payload structure for S2E.

## Status: COMPLETE
**Version**: v0.16.0 Griffin
