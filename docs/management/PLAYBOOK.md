# ArcRunner Playbook & SOPs

## 🤖 Agent Prompts
Use these templates when asking the Agent to perform management tasks.

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
