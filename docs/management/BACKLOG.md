# ArcRunner Backlog

## 🩹 Bugs / Technical Debt
- [ ] **Ghost Servers**: Ensure `kill-port` is robust across all OS versions.
- [ ] **Thumbnail FFMPEG**: Validate `ffmpeg-static` on Windows/Linux (currently Mac optimized).
- [ ] **Type Definitions**: Consolidate shared types (currently split between `lib` and `api`).

## 🎬 Episode / Clips
- [ ] **Extended Edit Mode**: Expose other fields + controls in the inline edit view.
- [ ] **Multi-Delete**: Select multiple clips and delete in batch.
- [ ] **Glitch**: "Save" button triggers other save buttons or UI states incorrectly.
- [x] **Start-to-End Frame**: (Released v0.16.0)
    - [x] Capture frames of Clips (preview?).
    - [x] In/Out points for morphing?
    - [x] Complex actions/Clip types.

## 🎨 Studio Screen
- [ ] **Seed Manager**: Manage/Recall favorite seeds.
- [ ] **Episode # in Studio**: Visible/Current Episode indicator.
- [ ] **Camera & Motion**:
    - [ ] Break out Camera + Motion into stacked fields.
    - [ ] Generate complete set of cameras + shot types (Tracking, etc.).

## 📋 Storyboard
- [ ] **Make Editable**: Allow drag-to-reorder and text editing directly on cards.

## 📄 Series / Scripting
- [ ] **Mega Prompt Update**: Inject Episode Number into library prompts via {{LIBRARY_KEYS}}.
- [ ] **Script Processing**: AI Agent to process Script Text -> JSON -> Studio Assets -> Episodes.
- [ ] **Script Markup**: Support markup for descriptions/Studio links.
