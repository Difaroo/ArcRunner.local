# Sprint v0.14.0: Hardening & Refactor

## Goal
Implement critical UI fixes (Shortcuts, Downloads) and verify core Rendering flows (Style/Flux) before major architectural refactor.

## Active Tasks
- [ ] **Core Features**
    - [x] **Shortcut Keys**: Implemented `useRowShortcuts`. (Verified).
    - [x] **Downloads**: Architecture normalized.

- [ ] **Payload Optimization (Priority)**
    - [x] **Prompt Engineering**: Reword System Prompt to prioritize "Style Reference Image" over weighted text. (Refined System Prompt + Negatives).
    - [x] **Cleanup**: Remove `randomSeed` and numeric weights (e.g. `:1.3`). (Hardcoded values used).
    - [x] **Testing**: Verify new prompt structure via Unit Test. (User verified).

- [ ] **Testing & Verification**
    - [ ] **Renders**:
        - [x] Verify `Style` in Studio affects reference image generation.
        - [x] Verify Studio Flux generation.
        - [ ] Verify Clips Flux/Video generation.
    - [ ] **Ref Save**: Can we save a Render as a Reference in Clips?

## Pending Review
- [ ] Review `docs/management/specs/Architecture_Refactor_Report.md` for upcoming "Big Refactor".
