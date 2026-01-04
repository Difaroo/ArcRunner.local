# High-Level Architecture (v0.15.0)

## 1. Core Structure
ArcRunner is a **Next.js** application using **Zustand** for state management and **server-side API routes** for data persistence.

### View Hierarchy
The monolith `page.tsx` has been refactored into modular Views:
*   `SeriesView`: Context management and Episode Prompt definition.
*   `ScriptView`: Bulk JSON data ingest.
*   `LibraryView` (Studio): Asset definition (Characters, Styles).
*   `EpisodeView` (Clips): The main workspace for generation.
*   `StoryboardView`: Output and presentation.

## 2. Data Flow
*   **Store**: A singleton `useStore` (Zustand) holds the client-side state of Clips, Library Items, and Series configuration.
*   **Persistence**:
    *   **Writes**: Components call API routes (`/api/clips/update`, `/api/library`, etc.) to persist changes to the backend (JSON/DB).
    *   **Reads**: A "Poller" (`usePolling`) periodically syncs the client state with the server, specifically checking for `generating` task completion.

## 3. The Prompt Engine
See the [User Manual](../management/USER_MANUAL.md) for detailed logic on Payload Builders (Flux, Nano, Veo).

## 4. Key Components
*   **ClipRow**: Heavily optimized (`React.memo`) table row component. Handles inline editing, image display, and generation triggers.
*   **ActionToolbar**: Context-aware toolbar that changes available actions based on the active View (e.g. "Generate Selected" in Studio vs "Generate All" in Clips).
