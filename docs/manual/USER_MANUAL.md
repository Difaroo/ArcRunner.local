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
