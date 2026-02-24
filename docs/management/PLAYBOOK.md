# ArcRunner Playbook
> [!CAUTION]
> **CRITICAL RULE: NO DIRECT WORK ON PRODUCTION**
> *   **Do NOT** fix, debug, or experiment on the Production Server (Port 3001).
> *   **Do NOT** run `npm run prod` or `sync` scripts to push changes to Prod unless explicitly instructed.
> *   All works happens in **DEV (Port 3000)**.
> *   If a prompt asks you to fix something, ALWAYS target `dev.db`.
> *   Prod is "Sacred Ground" - it should only run stable, released code manually synced by the user.

 & SOPs

## 🎯 Workflow Modes

Choose the right mode based on **risk level**:

| Mode | When to Use | Approval Needed? |
|------|-------------|------------------|
| **🟢 Quick** | Styling, copy, small fixes | No plan - just do it |
| **🟡 Standard** | New features, refactors | Brief inline explanation |
| **🔴 Formal** | Schema changes, architecture | Full `implementation_plan.md` |

---

## ⛔ Rules of Engagement (Golden Rules)

### 1. NO Direct Prod Updates
*   **NEVER** directly modify files on the Production Server (Port 3001).
*   **NEVER** run build/start commands for Production unless explicitly instructed to "Deploy Locally".
*   **NEVER** commit directly to `production` or `main` branches. Use Pull Requests or Merge workflows.

### 2. Environment Discipline
*   **Dev (Port 3000)**: Your playground. Hot reload active. Safe to break.
*   **Prod (Port 3001)**: Sacred ground. Only updated via `git merge` -> `build`.

### 3. Data Integrity
*   **NEVER** touch `prod.db` to fix a dev issue.
*   **ALWAYS** respect the wall between Dev Data and Prod Data.

---

## 🗺️ System Context & Onboarding (READ ME FIRST)

### 📚 Documentation Map
*   **User Manual**: [`docs/manual/USER_MANUAL.md`](file:///Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/docs/manual/USER_MANUAL.md) - Features & Flows.
*   **Architecture**: [`docs/architecture/HIGH_LEVEL_ARCH.md`](file:///Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/docs/architecture/HIGH_LEVEL_ARCH.md) - System Design.
*   **Render Engine**: [`docs/architecture/RENDER_ENGINE_ARCHITECTURE.md`](file:///Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/docs/architecture/RENDER_ENGINE_ARCHITECTURE.md) - Generation Pipeline.
*   **Golden Master**: [`docs/management/GOLDEN_MASTER.md`](file:///Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/docs/management/GOLDEN_MASTER.md) - API Specs.
*   **History**: [`docs/management/HISTORY.md`](file:///Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/docs/management/HISTORY.md) - Changelog.

### 🛠️ Server Management
**Production (Port 3001)**
*   **Deployment**: To deploy code updates to Production, run:
    ```bash
    ./scripts/restart-stack.sh
    ```
    This script performs: `Stop Processes` -> `npm run build` -> `Start Production (Background)`.
*   **Manual Restart**: If script fails, use: `npm run prod`.
*   **Logs**: `tail -f production.log` (if started via script) or check active terminal.

**Development (Port 3000)**
*   **Start**: `npm run dev`
*   **Database**: `prisma/dev.db`

### 🏗️ Tech Stack
*   **Frontend**: Next.js 14 (App Router), TailwindCSS, Radix UI.
*   **Backend**: Next.js API Routes, GenerateManager.
*   **Database**: SQLite (`dev.db`, `prod.db`) via Prisma.
*   **AI**: Kie.ai (Flux/Veo), OpenAI (Assistants).

---

## 🚀 Quick Mode Prompts

### Small Fix
> "Fix [specific issue]. No plan needed, just implement and verify."

### Styling Update
> "Update [component] styling: [describe changes]. Build and confirm."

### Hotfix
> "Production bug: [describe]. Fix immediately, deploy, confirm."

---

## 🔧 Standard Mode Prompts

### New Feature
> "Implement [feature name].
> - [Requirement 1]
> - [Requirement 2]
> Explain approach briefly, then implement."

### Refactor
> "Refactor [area] to [goal].
> Show me the key changes you'll make, then proceed."

---

## 📋 Formal Mode Prompts

### Complex Feature
> "Plan and implement [feature].
> 1. Create implementation plan.
> 2. Wait for my approval.
> 3. Implement with task.md tracking.
> 4. Verify and deploy."

### Schema Change
> "I need to add [field/table] to the database.
> Create a migration plan including:
> - Schema changes
> - Data migration if needed
> - Rollback strategy"

---

## 🛡️ Pre-Flight Check

### Agentic (Recommended)
> "Run pre-flight: tsc, lint, build. Fix any errors. Report when done."

The agent will:
1. Run `npx tsc --noEmit` → Fix errors → Re-run until pass
2. Run `npm run lint` → Fix errors → Re-run until pass
3. Run `npm run build` → Fix errors → Re-run until pass
4. Report completion

### Cognitive (For Complex Features)
Before committing, verify mentally:
- [ ] **Walkthrough**: Traced key execution paths?
- [ ] **Edge Cases**: Handles null, empty, unexpected input?
- [ ] **Defensive**: Error handling and validation present?

### Deploy
> "Deploy to production. Confirm healthy."

---

## 🔍 Debug Prompts

### Investigate Issue
> "The [screen/feature] is showing [problem].
> 1. Investigate the root cause.
> 2. Explain what's wrong.
> 3. Fix and verify."

### Trace Data Flow
> "Trace how [data/field] flows from [source] to [destination].
> Show me the code path."

### Check Production Logs
> "Check production logs for errors. Show recent issues."

---

## 🤖 Agent Prompts (Original)

### 🐛 Reporting a Bug
> "I found a bug in [Screen/Feature].
> **Context**: [Describe what happened]
> **Expected**: [Describe what should happen]
> Please log this to `BACKLOG.md` under [Category] and create a reproduction plan."

### 🚀 Starting a Sprint
> "Let's start Sprint [Version].
> Main Goal: [Goal Description].
> Please move the following items from `BACKLOG.md` to `SPRINT.md`:
> - [Item 1]
> - [Item 2]"

### 📦 Release & Version Bump
> "I am ready to release v[X.Y.Z].
> 1. Update `package.json` version.
> 2. Update `HISTORY.md` with a summary of `SPRINT.md`.
> 3. Update the UI Version badge.
> 4. Commit and Push."

---

## 🔄 Processes

### 1. The Sprint Cycle
1.  **Plan**: Select items from `BACKLOG.md` -> `SPRINT.md`.
2.  **Execute**: Agent works through `SPRINT.md` checklist.
3.  **Verify**: Agent updates `SPRINT.md` items to `[x]`.
4.  **Release**: Run "Release & Version Bump" prompt.
5.  **Archive**: Move `SPRINT.md` content to `HISTORY.md` and clear the list.

### 2. Archiving Plans
*   When an implementation plan is completed, the Agent should move it to `docs/management/archive/plans/implementation_plan_[YYYY-MM-DD].md`.

### 3. Pre-Deploy Checklist
Before any production deploy:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Local test of changed feature
- [ ] Commit with descriptive message
