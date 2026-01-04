# ArcRunner User Manual

> [!NOTE]
> This manual is organized by the logical **User Workflow** pipeline, from project selection to final export. It covers interactions, shortcuts, and system intelligence.

## 1. Series View
*The starting point: Project Context.*

### The "Episode Prompt"
The Series View defines the **Context String** (or "Mega Prompt") that governs the generation style for an entire episode.

**Variable Injection Logic:**
*   `{{SERIES_TITLE}}`: Automatically replaced with the Series Title.
*   `{{SERIES_STYLE}}`: Replaced with the "Overall Series Style" input (e.g., "1920s Noir").
*   `{{LIBRARY_KEYS}}`: **Dynamic List Generation**.
    *   Iterates through your **Studio** items for the active series.
    *   Generates a formatted list: `- Name (Type)`.
    *   *Usage*: Paste this into an LLM using the key to generate consistent, asset-aware scene descriptions.

---

## 2. Script View (Ingest)
*Step 1: Data Import & Initialization.*

The Script View is the entry point for bulk data. It initializes both the **Episode** (Clips) and the **Studio** (Assets) in one pass.

### JSON Structure
The ingestor expects a specific JSON format:
```json
{
  "clips": [
    {
      "scene": "1.1",
      "action": "A dark alleyway...",
      "dialog": "Hello world.",
      "character": "Detective Miller",
      "location": "Alley",
      "camera": "Wide Shot"
    }
  ],
  "library": [
    { "name": "Detective Miller", "type": "LIB_CHARACTER" },
    { "name": "Alley", "type": "LIB_LOCATION" }
  ]
}
```

### Ingest Logic
1.  **Creation**: Creates new rows in the `Clip` table for the current episode.
2.  **Auto-Linking**: 
    *   The system scans incoming clips for `character`, `location`, and `style` fields.
    *   It attempts to match these names (case-insensitive) against existing **Studio (Library)** items.
    *   *Result*: If "Detective Miller" exists in Studio, the new clip is automatically linked to his reference images.

---

## 3. Studio View (Library)
*Step 2: Asset Definition & Aesthetics.*

Before generating clips, define your assets here. The Studio manages the "Source of Truth" for your visual consistency.

### Asset Types
*   **Character**: Primary subjects (Actors, Creatures).
*   **Location**: Environments / Backgrounds.
*   **Style**: Pure visual instructions (e.g., "Oil Painting", "VHS", "Claymation").
*   **Camera**: Lens choices or angle definitions.

### Batch Workflows
*   **Generate Selected**: Select multiple items to generate their reference images in bulk.
*   **Settings Inheritance**: Batch generation uses the **currently active toolbar settings** (Style Strength, Seed, Aspect Ratio), overriding any per-item values.
*   **Duplication**: Creates copies with unique suffixes (`_Copy`).

---

## 4. Episode View (Clips)
*Step 3: Scene Management & Generation.*

This is the primary workspace where you generate the final video/image assets using the rules defined in Script and Studio.

### Interaction & Shortcuts
| Action | Shortcut | Scope |
| :--- | :--- | :--- |
| **Edit Clip** | Click any text cell | Cell |
| **Save Changes** | `Cmd + Enter` / `Ctrl + Enter` | Edit Mode |
| **Duplicate Clip** | `Cmd + D` / `Ctrl + D` | Edit Mode |
| **Delete Clip** | `Cmd + Backspace` / `Delete` | Edit Mode |
| **Cancel Edit** | `Esc` / `Cmd + .` | Edit Mode |

### Generation Logic
When you click **Generate**:
1.  **Ref Image Resolution**: The system fetches `refImageUrl` from linked Studio items.
2.  **Auto-Upload**: Local images (`/api/...`) are automatically uploaded to the cloud (Kie) to ensure the Model API can access them.
3.  **Prompt Construction**: The Clip's data is sent to the **Prompt Engine** (see Section 7) to build the final payload.

---

## 5. Storyboard View
*Step 4: Review & Export.*

The Storyboard filters out the noise (Edit details, status logs) to present a clean visual flow.

### Print & Export
Optimized for **PDF Export** via the browser's Print dialog (`Cmd + P`).
*   **3x2 (Landscape)**: Standard storyboard grid.
*   **6x1 (Portrait)**: Vertical shot list.
*   **Auto**: Responsive mix.

> [!TIP]
> **Hiding Clips**: use the "eye" icon to hide bad takes or alternate shots from the Storyboard without permanently deleting them from the Episode.

---

## 6. Settings
*Global configuration.*

### Templates
Define the base structure for your Episode Prompts.
*   **Video Template**: Context for Video models.
*   **Image Template**: Context for Flux/Still images.
*   *Persistence*: Saved to your browser's LocalStorage.

---

## 7. Under the Hood: The Prompt Engine

ArcRunner uses a sophisticated "Payload Builder" architecture to translate clip data into high-fidelity AI prompts.

### The "Sandwich" Strategy (Flux / Nano / Veo)
To ensure style consistency, the system constructs a complex prompt that separates *Style* from *Content*.

**Structure:**
1.  **System Priority Rule**: Instructs the model to treat a specific image (usually the last one) strictly as a **Style Source**.
    *   *Rule: "Image N+1 defines the STYLE... IGNORE the subject of Image N+1."*
2.  **Style Block**: Detailed visual style description.
    *   *Injects `[STYLE NEGATIVES]` from the Studio item.*
3.  **Subject Block**: The actual content (Character, Action, Location).
    *   *Injects `[SELECTED STUDIO ASSET NEGATIVES]`.*
4.  **Instruction Footer**: Reinforces the application of the Style to the Subject.
    *   *Typical Weighting: `Facial proportions and style: 150-160%`.*

### Model Specifics
*   **Flux (Image)**:
    *   **T2I Patch**: Injects a transparent dummy image if no reference images are provided (satisfies API requirements).
    *   **Guidance**: Calculated as `1.5 + (Strength - 1) * 0.94` (Maps 1-10 to 1.5-10.0 scale).
*   **Nano (Banana Pro)**: Enforces rigid formatting and dynamic "Image 1-N" variable ranges.
*   **Veo (Video)**: Defaults to `veo3_fast`. Falls back to "Cinematic" style if none provided. Defaults duration to 5s.

---

## 8. System Architecture Reference

### Persistence & Sync
*   **State Store**: Uses **Zustand** (memory) synced with `localStorage` for session persistence.
*   **Reactivity**:
    *   **Poller**: Runs every 15s to check for `generating` items server-side.
    *   **Live Updates**: Changing a Studio Asset's image propagates immediately to all Clip thumbnails using it via the `resolveClipImages` utility.

### Download Strategy
*   **Local Files**: Downloaded via direct browser link.
*   **Remote Files**: Routed through `/api/proxy-download` to bypass CORS issues and enforce strict naming.
*   **Naming Convention**: `[SERIES_NAME].[EPISODE] [SCENE_TITLE] [VERSION].ext`
