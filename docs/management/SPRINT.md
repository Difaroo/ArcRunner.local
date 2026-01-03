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
    - [x] **Persistence**: Implement custom filename format `[SERIES].[EPISODE] [NAME] [VERSION]` for downloads. (Implemented).
    - [x] **Nano Integration**:
        - [x] **Planning**: Gather specs for "Nano Banana" model.
        - [x] **Specs**: Define PayloadBuilder and Strategy pattern.
        - [x] **Implementation**: Payload Builder with dynamic numbering & Pro Template. (Verified).
        - [x] **Debugging**: Fix Batch Polling (Sequential) & Model Persistence.

- [ ] **Testing & Verification**
    - [x] **Renders**:
        - [x] Verify `Style` in Studio affects reference image generation.
        - [x] Verify Studio Flux generation.
        - [x] Verify Clips Flux/Video generation.
    - [x] **Ref Save**: Can we save a Render as a Reference in Clips?

## Pending Review
- [x] Review `docs/management/specs/Architecture_Refactor_Report.md` for upcoming "Big Refactor".
