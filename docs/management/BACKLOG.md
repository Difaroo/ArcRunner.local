# ArcRunner Backlog

## 🩹 Bugs / Technical Debt
- [ ] **Ghost Servers**: Ensure `kill-port` is robust across all OS versions.
- [ ] **Thumbnail FFMPEG**: Validate `ffmpeg-static` on Windows/Linux (currently Mac optimized).
- [ ] **Type Definitions**: Consolidate shared types (currently split between `lib` and `api`).

## 🎬 Episode / Clips
- [ ] **Extended Edit Mode**: Expose other fields + controls in the inline edit view.
- [ ] **Multi-Delete**: Select multiple clips and delete in batch.
- [ ] **Glitch**: "Save" button triggers other save buttons or UI states incorrectly.
## 🚀 Released v0.17.0 (Phoenix Polish)
- [x] **Data Integrity Firewall**: Whitelist/Sanitization to prevent result overwrites.
- [x] **Kling Priority**: Explicit override logic.
- [x] **Visibility Logic**: Hybrid deduplication for reference images.
- [x] **Prompt Safety**: Kling truncation (2000 chars).

## 🚀 Released v0.16.2 (Phoenix Stability)
- [x] **Nano Polling Loop**: Fixed infinite "Generating" loop for Nano models.
- [x] **Model Persistence**: Fixed data loss where `model` field wasn't saved to DB.
- [x] **Smart Merging**: Prevented Zombie Killer from destroying valid tasks during slow updates.
- [x] **Regression Testing**: Added `test-integrity.ts`.

## 🚀 Released v0.16.1 (Bugfix & Polish)
- [x] **Spinner Flicker**: Fixed race condition in Poller that caused premature stops.
- [x] **Style Payload Logic**: Fixed bug where style header was missing or incorrect for Text-Only styles.
- [x] **Data Robustness**: Added grace periods to `usePolling` and `generate-manager`.
- [x] **UI Polish**: Standardized Clip/Series views.

## 🚀 Released v0.16.0 (Griffin)
- [x] **Start-to-End Frame**:
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
