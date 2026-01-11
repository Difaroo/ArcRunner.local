# ArcRunner User Manual

## Overview
ArcRunner is a dual-intelligence system for generating video and image content. This manual details the system's behaviors, controls, and best practices.

## Universal Media Viewer (v0.17.1)
The unified **Universal Media Viewer** allows for checking references, reviewing generated clips, and editing metadata with speed and precision. Now supports optimized downloads and robust playlist navigation.

### Controls & Shortcuts
The viewer is designed for **keyboard-first** navigation.

| Shortcut | Action | Note |
| :--- | :--- | :--- |
| **Esc** | **Close** | Closes viewer without saving changes. |
| **Arrow Right / Left** | **Navigate** | Move to next/previous item in the playlist. |
| **Space** | **Play / Pause** | Toggles playback for Videos. |
| **d** | **Download** | Downloads the current file with its semantic filename. |
| **Delete / Backspace** | **Delete / Unlink** | Trashes root assets (with confirmation) or unlinks Reference images. |
| **Cmd+S** / **Cmd+Enter** | **Save Edits** | Commits changes to the Description or Action text. |

*Global Shortcuts*:
- **Esc** (in Tables): Instantly cancels Edit Mode for any row in Studio or Clips view.

### Display Logic
- **Aspect Ratio**: Locked to **16:9** for consistent review.
- **Titles**:
    - **Studio**: Displays `[ASSET NAME]` (e.g., "Cyberpunk Alley").
    - **Episode**: Displays `[SCENE #] [CLIP NAME]` (e.g., "3.1 Neon Rain"). This allows for easy correlation with your script.
- **Editing**: The text box at the bottom allows you to instantly edit the `Action` (for Clips) or `Description` (for Library Items). Use `Cmd+S` to save.

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

### Kling 2.6
- **Explicit Override**: Kling strictly uses a Single Reference Image.
- **Priority**: If you provide a **Manual Reference Image** (Explicit), Kling will use THAT image and ignore any Character/Location bios.
- **Fallback**: If no manual ref is provided, it falls back to Location -> Character image.

## Reference Image Visibility (v0.16.7 Hybrid Logic)
The "Ref Images" column in the Clip Table uses a smart hybrid logic:
1.  **Manual Adds**: Any URL you explicitly add/paste is **ALWAYS SHOWN**, even if it duplicates a Character thumb. This ensures you can verify your input.
2.  **Legacy Data**: For older clips where data was merged, the system hides duplicates to keep the interface clean.

## Render Engine Architecture
For a deep dive into the technical "under-the-hood" flow of the generating engine (from UI to Payload to Persistence), please refer to the [Render Engine Architecture Guide](../architecture/RENDER_ENGINE_ARCHITECTURE.md).

## Data Hygiene: Style Descriptions
**Critical Note**: When using "Text Only" styles (State B or D), ensure your Style Asset's text description does NOT contain phrases like "Follow STYLE REFERENCE IMAGE". Using such text without an actual image attached may confuse the model or cause it to hallucinate an image source.

