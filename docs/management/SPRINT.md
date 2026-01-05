# Sprint v0.16.0: Griffin (Veo S2E)

## Goal
Implement "Veo S2E" (Start-to-End) video generation, allowing users to define start and end frames using Reference Images 1 and 2.

## Active Tasks
- [ ] **UI Implementation**
    - [ ] Add "Veo S2E" to `ActionToolbar` Model Menu.
    - [ ] Ensure consistent "Bird" naming in internal docs.
- [ ] **Payload Logic**
    - [ ] Update `PayloadBuilderVeo.ts` to handle `veo-s2e` model ID.
    - [ ] Implement `IMAGE_TO_VIDEO` generation type logic.
    - [ ] Validate 2-image requirement (Start/End).
- [ ] **Verification**
    - [ ] Verify fallback to Text-to-Video if images missing.
    - [ ] Verify correct payload structure for S2E.

## Status: IN PROGRESS
**Version**: v0.16.0 Griffin
