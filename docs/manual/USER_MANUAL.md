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
- **Save / Download**: The Green "Floppy disk" button (and the Orange Download icon) both perform a direct **Save to Computer** action.
- **Edit Save**: The smaller Green "Check" button commits text edits (Description/Action) to the database.
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

## Prompt Logic & Architecture (v0.16.0 Matrix)

The system uses a deterministic "Logic Matrix" to construct payloads based on the Model and Input availability. This ensures optimal behavior without manual configuration.

### The 5 Logic States

| State | Model | Inputs | Logic Behavior | API Task Type |
| :--- | :--- | :--- | :--- | :--- |
| **A** | **Flux** | 1+ Images | **Legacy Sandwich**: Image 1 (Subject) + Prompt + Image 3 (Style) | N/A (Image) |
| **B** | **Flux/Veo** | Text + Style | **Text Style**: Applies style via text prompting only. | `TEXT_2_VIDEO` |
| **C** | **Veo Rep** | 1-3 Images | **Reference Mode**: Uses up to 3 images as "Character/Location" references. | `REFERENCE_2_VIDEO` |
| **D** | **Veo** | 0 Images | **Text Only**: Pure text-to-video generation. | `TEXT_2_VIDEO` |
| **E** | **Veo S2E** | 2 Images | **Start-to-End**: Transitions strictly from Image 1 to Image 2. | `IMAGE_TO_VIDEO` |

### Image Hierarchy
When resolving multiple images (e.g., Location + Characters), the system fills slots in this priority order (Max 3):
1.  **Location** (Always Image 1 if present)
2.  **Character 1**
3.  **Character 2** / Reference
*Note: If a Style Image is active (State C), it takes the LAST slot.*

### Validation & Fallback
-   **S2E Safety**: If "Veo Start 2 End" is selected but only 1 image is available, the system automatically downgrades to **State C (Reference Mode)** to prevent errors.
-   **Ghost Images**: The system validates exact URL existence. Empty names or "undefined" strings are filtered out before payload construction.

### Veo Builder Specifics
-   **Dynamic Numbering**: Automatically rewrites prompts to reference "[Image 1]", "[Image 2]" corresponding to the Legend.
-   **Duration**: Defaults to 5 seconds unless explicitly set to 10.

### Nano (Experimental)
- Uses "Hardcoded Pro" template similar to Flux but optimized for self-hosting speed.
- Enforces strict aspect ratio handling.

## Render Engine Architecture
For a deep dive into the technical "under-the-hood" flow of the generating engine (from UI to Payload to Persistence), please refer to the [Render Engine Architecture Guide](../architecture/RENDER_ENGINE_ARCHITECTURE.md).

## Data Hygiene: Style Descriptions
**Critical Note**: When using "Text Only" styles (State B or D), ensure your Style Asset's text description does NOT contain phrases like "Follow STYLE REFERENCE IMAGE". Using such text without an actual image attached may confuse the model or cause it to hallucinate an image source.

