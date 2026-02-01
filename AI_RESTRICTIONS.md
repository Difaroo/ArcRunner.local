# ⛔️ PRODUCTION RULES (READ CAREFULLY) ⛔️

## THE GOLDEN RULE
**NEVER DEBUG OR FIX ON PROD.**
Production (Port 3001 / `prod_v2.db`) is for **DEPLOYMENT ONLY**.

## ✅ AUTHORIZED ACTIONS (When Requested)
*   **Deploy:** You MAY run `npm run prod` when the user asks to "Push to Prod" or "Deploy".
*   **Migrate:** You MAY run `prisma migrate deploy` against `prod_v2.db` IF it is part of a requested deployment.

## ⛔️ STRICTLY FORBIDDEN (NO EXCEPTIONS)
*   **Debugging:** NEVER open `localhost:3001` in a browser tool to investigate bugs.
*   **Hot-Fixing:** NEVER edit files to fix a bug that was found on Prod. Fix it on Dev (Port 3000) first.
*   **Ad-Hoc Commands:** NEVER run random queries or checks against `prod_v2.db`.

---
*Summary: Treat Prod as a "Read-Only / Deploy Target". Do all your thinking and fixing on Dev.*
