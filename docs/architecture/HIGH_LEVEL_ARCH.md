# ArcRunner High Level Architecture

## 🏗️ System Overview
ArcRunner is a local-first, AI-assisted video production studio. It orchestrates the generation of video clips from text scripts using a multi-model approach (Veo, Flux, Nano) and a unified timeline interface.

### Core Components

#### 1. The Body (Frontend)
- **Framework**: Next.js 14 (App Router)
- **State Management**: `useDataStore` (Zustand) - Decoupled from UI components.
- **Components**: Modularized View Components (`SeriesPage`, `ClipTable`, `StoryboardView`).
- **Styling**: TailwindCSS + `shadcn/ui`.

#### 2. The Brain (Backend / API)
- **Route Handlers**: Next.js API Routes (`src/app/api/*`).
- **Database**: SQLite (via Prisma). Dual-environment inputs (`dev.db` vs `prod.db`).
- **Orchestration**:
    - **GenerateManager**: The central conductor for all generation tasks.
    - **KieClient**: Facade for external Model APIs (Veo, Flux).
    - **Polling**: Robust "Zombie-Proof" polling mechanism (`usePolling` + `api/poll`) handles long-running async tasks.

#### 3. The Strategy Engine (Prompting)
- **PromptSelector**: "Strategy Pattern" for selecting the correct prompt architecture based on Model and Inputs.
- **Schemas**:
    - `StandardSchema`: The default "ABCD" format (Action, Background, Character, Dialog).
    - `TransitionSchema`: Specialized for S2E (Start-to-End) morphs.
    - `LegacySchema`: Backwards compatibility for older Flux models.
- **Builders**: `BuilderFactory` creates model-specific payloads (`VeoPayload`, `FluxPayload`).

## 🔄 Key Flows

### A. Generation Flow
1.  **User Click**: "Generate" button triggered in UI.
2.  **Optimistic UI**: `useDataStore` updates Clip status to "Generating" immediately.
3.  **API Call**: `POST /api/generate` is called with Clip Data.
4.  **Manager**: `GenerateManager` resolves assets, builds payload, and calls `Kie`.
5.  **Task ID**: `Kie` returns a Task ID. Manager writes this to DB.
6.  **Polling**: Frontend `usePolling` hook detects "Generating" status and polls `/api/poll` until completion.
    *   *Robustness*: Poller waits for Task ID visibility to prevent "Flicker".

### B. Persistence Logic
- **Dual Update**: All saves perform an **Optimistic Update** (React State) followed by an **API Call** (DB Write).
- **Reversion**: If API fails, state is reverted to snapshot.
- **Local Config**: Non-critical UI state (Last Series, View Mode) is persisted in `localStorage`.

## 📂 Directory Structure
- `src/app`: Routes & Pages.
- `src/components`: UI Components (Atomic Design).
- `src/lib`: Core Logic ("The Brain").
- `src/hooks`: React Hooks (Logic/State binding).
- `prisma`: Database Schema & Migrations.
- `scripts`: Maintenance & Test scripts.
