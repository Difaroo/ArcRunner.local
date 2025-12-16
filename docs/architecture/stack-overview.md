# Tech Stack Overview

## Core Framework
*   **Framework**: [Next.js 13](https://nextjs.org/) (App Directory)
*   **Runtime**: Node.js
*   **Language**: TypeScript

## Database & Data
*   **Database**: PostgreSQL
*   **ORM**: [Prisma](https://www.prisma.io/)
*   **External Data**: Google Sheets (via `googleapis`) for script/series sync.

## Frontend & UI
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Components**: [Radix UI](https://www.radix-ui.com/) (Primitives), `lucide-react` (Icons).
*   **Interactivity**: `@dnd-kit` (Drag & Drop sorting).

## AI & Generation Pipeline
*   **Image/Video Gen**: [Kie.ai](https://kie.ai/) (Flux & Veo Models).
*   **Orchestration**: Custom `GenerateManager` (Server-side queue & state management).
*   **Assistant**: OpenAI (via `openai`) for text/prompt logic.

## Testing & Infrastructure
*   **E2E Testing**: [Playwright](https://playwright.dev/).
*   **Environment**: Docker (Dockerfile present).

---
[🏠 Back to Index](../README.md)
