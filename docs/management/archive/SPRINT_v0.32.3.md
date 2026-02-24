# Sprint Archive: v0.32.3 (Backend Sync & Data Recovery)

## Goal
The goal of this sprint was to perfectly synchronize the decoupled Development and Production database environments, while recovering lost legacy data and rushing to persist expiring generation links from third-party APIs.

## Tasks Completed
- Diagnosed the cause of the "Failed to fetch" production server crash as simply being an offline NextJS server, NOT a schema-breaking layout error as suspected.
- Located an offline backup `prod_v2.db` and wrote `scripts/recover-prod-csv.ts` to seamlessly inject 28 lost legacy `refImageUrls` string vectors directly into the active `Media` table.
- Wrote `scripts/batch-persist.ts` to mass download expiring links, but discovered the Kiel assets had already 404'd and been deleted from remote host.
- Pivoted strategy and engineered an offline persistence tool. The script scans a local desktop directory (provided by the user via terminal parameter overrides). It reads all `.mp4` files, uses RegEx heuristic matching on the filename (searching for matching Scene Number strings + Title strings simultaneously), and forcefully links them back up to the Prisma `Clip` record.
- This reverse-sync clones the file into local caching, creates formatted Aliases across nested subdirectories, points the Episode `localMediaPath` correctly, and triggers the UI Traffic Light green.
- Backfilled 52 total offline videos safely into the infrastructure.
- Cloned single edge-case Clip 4.2 physically via terminal SQLite piping.
- Wrote `scripts/sync-dev-to-prod.ts` to completely obliterate `prod_v2.db` and replace it with `dev.db` exactly, enforcing a 100% parity lock between Dev and Prod architectures.

## Key Takeaways
Always test migration boundaries in a secondary database instance. While `migrate:deploy` handled the schema updates functionally, the raw SQL drop routines evaporated un-migrated raw strings. Fortunately the standard `.backup` script protocols caught the edge case.
