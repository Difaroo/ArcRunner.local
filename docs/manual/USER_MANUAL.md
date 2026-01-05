# ArcRunner User Manual

## Overview
ArcRunner is a dual-intelligence system for generating video and image content. This manual details the system's behaviors, controls, and best practices.

## Media Player Controls
The global **Video Player / Media Viewer** (accessible via thumbnails) supports keyboard navigation for efficient review:

| Key | Action |
| :--- | :--- |
| **Arrow Right** | Next item in playlist |
| **Arrow Left** | Previous item in playlist |
| **Escape** | Close viewer |

### Video Overlay Controls
- **Edit**: Modify Clip Action or Library Description directly while viewing.
- **Download**: Top-right orange icon to save the file locally.
- **Save**: Green check button to commit text edits.
- **Ref Image**: "Save Reference Image" button captures the current frame/image for the library.

## Generation Workflows

### Batch Generation
When generating multiple items (Clips or Library Assets), a **Confirmation Dialog** will appear to prevent costly mistakes.
**Always Review**:
- **Count**: Total items to be generated.
- **Model**: The AI model being used (e.g., `flux`, `veo-3`).
- **Style**: Applied style preset (e.g., `Cinematic`, `Clay`).
- **Ratio**: Aspect ratio/Viewport.

### Episode Creation
- **Optimistic Updates**: New episodes appear instantly in the list.
- **Error Handling**: Network errors during creation will be displayed visually in the dialog.

## System Intelligence
- **Persistence**: Application state (Series, Episodes) is stored in a local SQLite database (`v0.15_RECOVERY_DATA.db`) but presented via the robust v0.14.2 UI.
- **Polling**: Background polling ensures generation status updates are reflected in near real-time.

## Prompt Mechanics (New in v0.15)
The generation engine now uses specialized "Builders" for each model type, ensuring optimal prompt construction.

### Flux (Image)Builder
- **Sandwich Prompt Logic**: 
  - **Start**: Reference Image 1 (Subject)
  - **Middle**: Prompt Text + Style Description
  - **End**: Reference Image 3 (Style)
- **Guidance Scale**: Auto-calculated based on "Style Strength". 
  - Formula: `1.5 + ((strength - 1) * (8.5 / 9))`.
  - Default: ~5.0.

### Veo (Video) Builder
- **Dynamic Numbering**: Automatically rewrites prompts to reference "Image 1", "Image 2" etc.
- **Duration**: Defaults to 5 seconds unless explicitly set to 10.
- **Veo S2E (Start-to-End)**:
    - **Purpose**: Generates video transitioning from a Start Frame to an End Frame.
    - **Requirements**:
        - **Image 1**: Start Frame.
        - **Image 2**: End Frame.
    - **Fallback Behavior**:
        - **1 Image**: Falls back to "Reference-to-Video" using Image 1 as Start (Standard behavior).
        - **0 Images**: Falls back to "Text-to-Video".

### Nano (Experimental)
- Uses "Hardcoded Pro" template similar to Flux but optimized for speed.
- Enforces strict aspect ratio handling.
