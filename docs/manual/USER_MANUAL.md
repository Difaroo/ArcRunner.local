# ArcRunner User Manual

## Overview
ArcRunner is a dual-intelligence system for generating video and image content. This manual details the system's behaviors, controls, and best practices.

## Settings & Global Catalogue (v0.31.3)
The **Settings** page now hosts the **Global Catalogue** for managing reusable "Vibes".

### Cameras & Movement
- **Global Scope**: Items added here are available across ALL Series and Episodes.
- **Management**: You can Add, Edit, or Sort (Drag & Drop) items in the "Cameras" and "Movement" tabs.
- **Seeding**: The system comes pre-loaded with standard industry lenses (Anamorphic, Macro) and movements (Dolly, Pan, Tilt).

## Media Library (v0.30.0)

### Infinite Scroll
The Media Library uses **infinite scroll** for seamless browsing of generated content. As you scroll down, additional media items load automatically.

**Key Behaviors**:
- **Progressive Loading**: Media loads in batches as you approach the bottom of the current view.
- **Performance**: Optimized for large collections (hundreds of items) without lag.
- **Navigation**: No manual pagination required—simply scroll to browse your entire library.

**Tips**:
- Use browser search (Cmd+F) to find specific media if needed.
- The scroll position resets when changing episodes or series.

## Universal Media Viewer & Studio (v0.18.0)
The unified **Universal Media Viewer** allows for checking references, reviewing generated clips, and editing metadata with speed and precision. Now supports optimized downloads and robust playlist navigation.

**v0.18.0 Note**: Studio References now behave identically to Clip References. The system uses a strict **Media-First** architecture, meaning `Media` table records are the single source of truth. Drag & Drop operations are fully atomic with optimistic rollback protection.

### Controls & Shortcuts
The viewer is designed for **keyboard-first** navigation.

| Shortcut | Action | Note |
| :--- | :--- | :--- |
| **Esc** | **Close** | Closes viewer without saving changes. |
| **Arrow Right / Left** | **Navigate** | Move to next/previous item in the playlist. |
| **Space** | **Play / Pause** | Toggles playback for Videos. |
| **Cmd+S** | **Download** | Downloads the current file. |
| **Cmd+Shift+A** | **Add Result** | Adds the current Result to the Clip as a Reference. |
| **Cmd+Shift+U** | **Unlink** | Unlinks Reference images or Clears Results. |
| **Delete / Backspace** | **Delete** | Trashes root assets (with confirmation). |
| **Cmd+Enter** | **Save Edits** | Commits changes to the Description or Action text. |

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
- **Persistence**: Application state (Series, Episodes) is stored in a local SQLite database (`prod_v2.db` in Prod).
- **Process Robustness (v0.24.0)**: The system is managed by **PM2**, ensuring zero-downtime restarts and eliminating "zombie" processes.
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

### Image Hierarchy (v0.20.0)
When resolving multiple images for generation, the system fills slots in this priority order based on model type:

| Model | Capacity | Priority Order |
| :--- | :--- | :--- |
| **Veo** | 3 | Style → Location → Character(s) → Refs |
| **Kling** | 1 | Latest Ref Image ONLY |
| **S2E** | 2 | Ref[0] = Start Frame, Ref[1] = End Frame |
| **Nano/Flux** | 8 | Style → Location → Character(s) → Refs |

**Notes**:
- **Ref Ordering**: New references are prepended (latest first), so the most recent ref is prioritized for I2V start frames.
- **Style Position**: Style is now the FIRST slot (previously last) to ensure consistent artistic direction.
- **Kling**: Only accepts 1 image—always the latest ref.

### Validation & Fallback
-   **S2E Safety**: If "Veo Start 2 End" is selected but only 1 image is available, the system automatically downgrades to **State C (Reference Mode)** to prevent errors.
-   **Ghost Images**: The system validates exact URL existence. Empty names or "undefined" strings are filtered out before payload construction.

### Veo Builder Specifics
-   **Dynamic Numbering**: Automatically rewrites prompts to reference "[Image 1]", "[Image 2]" corresponding to the Legend.
-   **Duration**: Defaults to 5 seconds unless explicitly set to 10.

### Nano (Experimental)
- Uses "Hardcoded Pro" template similar to Flux but optimized for self-hosting speed.
- **CRITICAL**: Nano (Banana) is an **IMAGE GENERATOR** (Google). It outputs PNGs. 
- The system defaults to downloading these results locally (Media Persistence).
- Enforces strict aspect ratio handling.

### Kling 2.6 (Video)
-   **Minimalist Schema**: Kling uses a special "Minimalist" prompt structure.
    -   **Content**: Only the `Action` and `Camera` instructions are sent as text.
    -   **Visuals**: Visual details (Characters, Locations) are derived **100%** from the Reference Image. Text bios are omitted to prevent token bloat and hallucinations.
    -   **Strict Requirement (v0.25+)**: You MUST provide a **Manual Reference Image** (Drag & Drop or Upload). The system will now Block generation (Error 400) if no explicit reference is found, to prevent wasted credits. Studio Defaults (Characters/Locations) are **NOT supported** for this model.
-   **Explicit Resolution**: Fix applied (v0.17.4) allowing local "Generated Clips" (`/media/clips/`) to be used as Reference Images without error.

### Start Frame Intelligence (v0.17.3 - Image Models Only)
**Scope**: This feature only activates for **Image Models** (Nano, Flux) to generate clean "Start Frames". Video Models (Veo, Kling) bypass this logic to preserve full temporal instructions.

When **Start Frame** is selected:
1.  **Action Truncation**: Truncates Action to the **First Sentence**.
2.  **Character Filtering**: Filters specific characters based on that sentence.

## Reference Image Visibility (v0.16.7 Hybrid Logic)
The "Ref Images" column in the Clip Table uses a smart hybrid logic:
1.  **Manual Adds**: Any URL you explicitly add/paste is **ALWAYS SHOWN**.
2.  **Legacy Data**: For older clips where data was merged, the system hides duplicates to keep the interface clean.

## Render Engine Architecture
For a deep dive into the technical "under-the-hood" flow of the generating engine (from UI to Payload to Persistence), please refer to the [Render Engine Architecture Guide](../architecture/RENDER_ENGINE_ARCHITECTURE.md).

## Data Hygiene: Style Descriptions
**Critical Note**: When using "Text Only" styles (State B or D), ensure your Style Asset's text description does NOT contain phrases like "Follow STYLE REFERENCE IMAGE". Using such text without an actual image attached may confuse the model or cause it to hallucinate an image source.

## Media Management & Pool Logic (v0.31.5)

The distinction between the Asset Pool and Model Input Slots (MIS) is a core architectural concept ensuring clean separation between long-term references and active generation styling.

### 1. Asset Pool vs. Model Input Slots (MIS)
- **Asset Pool**: The Pool represents the broader collection of media available for an Episode, including explicitly defining Studio Items (Characters, Locations) and generated raw media. It acts as the source gallery.
- **Model Input Slots (MIS)**: The MIS represents the active payload destination. When you "Add Reference" (using the Arrow button) from the Pool or the Universal Media Viewer, you are loading that asset into an active slot to be dispatched in the next generation payload in the absence of Studio items.

### 2. Unlink Logic
The behaviour of the "Unlink" action depends contextually on the asset type being detached:
- **Studio Items**: Unlinking a Character or Location removes it from the Clip, deleting the entry from the relevant text classification fields.
- **Pool Items**: Unlinking returns the media record to the broader episode Media screen by detaching it from the specific target Clip (essentially nullifying the `clipId` on the Media item).
- **MIS Loaded Assets**: Unlinking an asset actively sitting inside an MIS slot simply returns it to the Pool.
- *Note: **Delete** is exclusively reserved for the Media Screen and permanently trashes the record. It is intentionally omitted from the UVM to prevent accidental destructive actions.*

### 3. Persist & Download Architecture
Media results are handled differently based on output type to optimize bandwidth and local storage:
- **Image Results**: Generated as static assets or downloaded locally by default. Users can save them to their own local file using the Download button.
- **Video Results**: Video generation results are hosted temporarily at Kie.ai (the API aggregator). 
  - The "Persist/Download" action pulls this video from the temporary cloud layer to the server's local storage.
  - On the first interaction, it presents an OS-level save dialogue to define a destination folder for video editing.
  - The system then saves this directory path to the current Episode record. 
  - Thereafter, it operates silently in the background, downloading results directly to the established local folder and inserting an alias back into the ArcRunner UI for seamless playback.

## Visual Reference Management (v0.18.0)

### Drag & Drop Workflow
Refine your clips with seamless Drag & Drop actions directly in the standard view.

1.  **Results to References (Sideloading)**:
    -   Drag a generated image from the **RESULT** column.
    -   Drop it onto the **REF IMAGES** column of the same row (or any other row).
    -   **Result**: The image is instantly added as a reference.

2.  **Display Mode Sorting**:
    -   Drag any thumbnail within the **REF IMAGES** list to reorder or move it to another clip.
    -   Ideal for quickly copying a "perfect style ref" across multiple scenes.

3.  **Optimistic Error Handling**:
    -   The UI updates **instantly** (0ms latency).
    -   If the background save fails, the UI automatically **reverts** to prevent "ghost data".

### Architecture Note: Media-First (v0.23.0)
As of v0.23.0, the system stores all media links in a relational `Media` table directly linked to Episodes.
-   **Episode-Based Ownership**: Media items belong to an Episode, not just a Clip. This means "unlinking" a media item from a clip does not delete it; it returns to the Episode Gallery.
-   **Unified Playlist**: Clicking a Reference Image in the Clip Table now opens a playlist that *includes* the Result, Explicit References, and all resolved Character/Location images, allowing for seamless swiping throughout the entire row context.
-   **Safe Unlinking**: Unlinking a Result now correctly clears the "ghost" thumbnail and resets the Clip status to Ready, ensuring you never see stale data.
-   **Legacy CSV columns** (`resultUrl`, `refImageUrls`) are **Dead**. As of v0.28.0, the system strictly ignores these columns. Any data found there is considered "Ghost Data" and is not displayed.


