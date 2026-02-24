/**
 * scripts/sync-dev-to-prod.ts
 * 
 * Final synchronization script. Takes the current state of `prisma/dev.db`
 * and forcefully overwrites `prisma/prod_v2.db` with it, creating a timestamped
 * backup of the production database first.
 * 
 * WARNING: This completely replaces the Production database.
 */

import fs from 'fs';
import path from 'path';

const DEV_DB_PATH = path.resolve(process.cwd(), 'prisma', 'dev.db');
const PROD_DB_PATH = path.resolve(process.cwd(), 'prisma', 'prod_v2.db');

async function main() {
    console.log(`=========================================`);
    console.log(`🚀 Final Dev -> Prod Sync`);
    console.log(`=========================================\n`);

    if (!fs.existsSync(DEV_DB_PATH)) {
        console.error(`[ERROR] Dev database not found at ${DEV_DB_PATH}`);
        process.exit(1);
    }

    if (!fs.existsSync(PROD_DB_PATH)) {
        console.error(`[ERROR] Prod database not found at ${PROD_DB_PATH}`);
        process.exit(1);
    }

    // 1. Create Timestamped Backup of Prod
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${PROD_DB_PATH}.backup_pre_final_sync_${timestamp}`;

    console.log(`[Backup] Creating safety backup of Prod database...`);
    fs.copyFileSync(PROD_DB_PATH, backupPath);
    console.log(`[Backup] ✓ Created: ${backupPath}\n`);

    // 2. Perform Overwrite
    console.log(`[Sync] Overwriting Prod with Dev...`);
    fs.copyFileSync(DEV_DB_PATH, PROD_DB_PATH);
    console.log(`[Sync] ✓ Overwrite complete.\n`);

    // 3. Verify File Sizes match
    const devStats = fs.statSync(DEV_DB_PATH);
    const prodStats = fs.statSync(PROD_DB_PATH);

    console.log(`=========================================`);
    console.log(`[VERIFICATION]`);
    console.log(`Dev DB Size:  ${devStats.size} bytes`);
    console.log(`Prod DB Size: ${prodStats.size} bytes`);

    if (devStats.size === prodStats.size) {
        console.log(`\n✅ SUCCESS: Databases are fully synchronized.`);
        console.log(`Please restart the application to clear any cached Connections.`);
    } else {
        console.log(`\n❌ WARNING: File sizes do not match. Something may have gone wrong.`);
    }
    console.log(`=========================================\n`);
}

main();
