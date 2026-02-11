# Database Management & Migration Protocol

## Overview
This project uses **SQLite** with **Prisma**. Due to SQLite's file-based nature and Prisma's strict schema enforcement, database resets can happen easily if migration history drifts.

To prevent data loss, we have implemented a **Strict Safety Protocol** wrapping all migration commands.

## 🛡️ Safety Mechanisms

### 1. Development (`npm run migrate:dev`)
*   **Command**: `./scripts/safe-migrate-dev.sh`
*   **Action**: Backs up `dev.db` -> Runs `prisma migrate dev`
*   **Why**: Development requires creating *new* migrations (`migrate dev`). If Prisma detects drift and asks to reset, the **backup protects your data**.

### 2. Production / Deployment (`npm run migrate:deploy`)
*   **Command**: `./scripts/deploy-migration.sh`
*   **Action**: Backs up `prod_v2.db` -> Runs `prisma migrate deploy`
*   **Why**: Production should *never* reset. `migrate deploy` applies pending migrations without resetting. The backup is a fail-safe in case of corruption or failed application.

## 🚨 Critical Rules for Developers & AI
1.  **NEVER** run `npx prisma migrate ...` directly. ALWAYS use the `npm run` scripts.
2.  **NEVER** delete `backups/db/` without verification.
3.  **IF** `migrate:dev` asks to reset:
    *   It is generally *safe* to say **YES** because a backup was just created.
    *   *However*, try to understand why drift occurred (e.g. manual DB edits).
4.  **IF** data is lost:
    *   Immediately check `backups/db/` for the most recent timestamped file.
    *   Restore using `cp backups/db/[file].bak prisma/[target].db`.

## Troubleshooting "Drift"
If Prisma complains about drift:
1.  It means the database schema (in SQLite) does not match the migration history table.
2.  This often happens if you switched branches or manually edited class tables.
3.  **Fix**: Let `migrate:dev` reset the DB (after backup), then use a script to re-import necessary data if needed, or restore from backup if the reset was accidental.
