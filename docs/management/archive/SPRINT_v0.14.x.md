# Sprint v0.14.x: Hardening, Refactor, & Veo Polish

## Goal
Implement critical UI fixes (Shortcuts, Downloads) and verify core Rendering flows (Style/Flux) before major architectural refactor. Polished Veo generation logic and persistence in v0.14.2.

## Completed Tasks

### Core Features
- [x] **Shortcut Keys**: Implemented `useRowShortcuts`. (Verified).
- [x] **Downloads**: Architecture normalized to Hybrid (Direct/Proxy).

### Payload Optimization
- [x] **Prompt Engineering**: Reword System Prompt to prioritize "Style Reference Image" over weighted text.
- [x] **Cleanup**: Remove `randomSeed` and numeric weights (e.g. `:1.3`).
- [x] **Testing**: Verify new prompt structure via Unit Test.
- [x] **Persistence**: Implement custom filename format `[SERIES].[EPISODE] [NAME] [VERSION]` for downloads.
- [x] **Nano Integration**: 
    - [x] **Specs**: Define PayloadBuilder and Strategy pattern.
    - [x] **Implementation**: Payload Builder with dynamic numbering & Pro Template.
    - [x] **Debugging**: Fix Batch Polling (Sequential) & Model Persistence.

### v0.14.2 Specifics (Veo & Logic)
- [x] **Veo Multi-Image**: Fixed logic to allow `all` reference images for Veo task types.
- [x] **Veo Prompt Logic**: Ported `Nano` builder logic (Dynamic Numbering, Style/Subject blocks, Negatives).
- [x] **Dialog Restoration**: Restored the controlled Confirmation Dialog for clip generation.
- [x] **Robustness**: Added automatic URL encoding for filenames with spaces.

### Testing & Verification
- [x] **Renders**:
    - [x] Verify `Style` in Studio affects reference image generation.
    - [x] Verify Studio Flux generation.
    - [x] Verify Clips Flux/Video generation.
- [x] **Ref Save**: Confirmed saving a Render as a Reference.

## Legacy & Review
- [x] Reviewed `docs/management/specs/Architecture_Refactor_Report.md` for upcoming "Big Refactor".
