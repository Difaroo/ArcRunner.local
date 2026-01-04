# ArcRunner User Manual

> [!NOTE]
> This document details the specific "Under the Hood" behaviors of ArcRunner, particularly the AI generation logic that is not visible in the UI.

## Model Logic & Prompt Engineering

ArcRunner uses specialized builders to construct sophisticated prompts for different models.

### 1. Flux (Image Generation)
**Uses**: `PayloadBuilderFlux.ts`
The Flux builder employs a "Sandwich" prompt structure to strictly separate Style from Subject.

- **System Header**: Injects a `PRIORITY RULE` declaring the Reference Image (usually the last one) as the "ABSOLUTE STYLE SOURCE".
- **Style Block**:
  - Located *before* the Subject description.
  - Injects `[STYLE NEGATIVES]` if defined in the Studio item.
  - Default Fallback: "Cinematic".
- **Subject Block**:
  - Labelled `OUTPUT SUBJECT`.
  - Injects `[SELECTED STUDIO ASSET NEGATIVES]`.
- **Instruction Footer**:
  - Hardcoded Weights: `Facial proportions and style: 160%`.
  - Maps UI Strength (1-10) to API Guidance Scale (1.5 - 10.0).

### 2. Veo (Video Generation)
**Uses**: `PayloadBuilderVeo.ts`
Veo logic has been ported to match the "Nano" style structural prompting.

- **Dynamic Numbering**:
  - Scans input images. If > 1 image, it identifies the *last* image (or specific Style Index) as the Style Reference (`Image N+1`).
  - identifies the preceding images as `SUBJECT IMAGES 1-N`.
- **Prompt Structure**:
  - **System**: "Image N+1 defines the STYLE... IGNORE the subject of Image N+1."
  - **Body**: Merges `styleDescription` and `styleNegatives`.
  - **Instruction**: Applies `Facial style: 150%` weighting.
- **Defensive Defaults**:
  - `duration`: Defaults to '5' (seconds) if not specified.
  - `aspectRatio`: Defaults to '16:9'.

### 3. Nano (Banana Pro)
**Uses**: `PayloadBuilderNano.ts`
Experimental builder for high-fidelity style transfer.

- **Priority**: Strict adherence to `[SYSTEM: PRIORITY RULE]`.
- **Strength Mapping**:
  - Converts UI Strength (1-10) directly to a percentage in the prompt (e.g. `Facial style: 50%`).
- **Safety**:
  - Truncates prompts at 20,000 characters to prevent API rejection.

## Download & File Management

### Hybrid Download Strategy
- **Local Files**: Downloaded immediately via direct link.
- **Remote Files**: Routed through `/api/proxy-download` to handle CORS and strict filename sanitization.
- **Naming Convention**: `[SERIES_NAME].[EPISODE] [SCENE_TITLE] [VERSION].ext`

## Persistence Architecture
- **State Store**: Uses `Zustand` (memory) synced with `localStorage` (persistence).
- **Studio <> Episode Sync**:
  - Changing "Style" in Studio updates the global selection.
  - Changing "Aspect Ratio" in Episode updates the global default.
- **Reactivity**:
  - "Poller" runs every 15s to check for `generating` items.
  - Reference updates (e.g. changing a Character image) propagate to Clip thumbnails immediately via the `resolveClipImages` utility.
