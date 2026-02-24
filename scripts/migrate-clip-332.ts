/**
 * scripts/migrate-clip-332.ts
 * 
 * One-time script to migrate Clip 332 (4.2 Recovered Craft) and its Media records 
 * from the Dev database to the Prod database.
 */

import Database from 'better-sqlite3';
import path from 'path';

const DEV_DB_PATH = path.resolve(process.cwd(), 'prisma', 'dev.db');
const PROD_DB_PATH = path.resolve(process.cwd(), 'prisma', 'prod_v2.db');

async function main() {
    console.log(`[Migration] Connecting to Dev and Prod databases...`);
    const devDb = new Database(DEV_DB_PATH, { readonly: true });
    const prodDb = new Database(PROD_DB_PATH);

    const targetClipId = 332;

    prodDb.prepare('BEGIN TRANSACTION').run();

    try {
        // 1. Check if Clip exists in Prod
        const prodClipExists = prodDb.prepare('SELECT id FROM Clip WHERE id = ?').get(targetClipId);
        if (prodClipExists) {
            console.log(`[Migration] Clip ${targetClipId} already exists in Prod database. Removing old version first...`);
            prodDb.prepare('DELETE FROM Clip WHERE id = ?').run(targetClipId);
        }

        // 2. Fetch Clip from Dev
        const devClip = devDb.prepare('SELECT * FROM Clip WHERE id = ?').get(targetClipId) as any;
        if (!devClip) {
            throw new Error(`Clip ${targetClipId} not found in Dev database!`);
        }

        console.log(`[Migration] Found Clip: ${devClip.scene} ${devClip.title}`);

        // 3. Insert Clip into Prod
        const clipKeys = Object.keys(devClip);
        const clipPlaceholders = clipKeys.map(() => '?').join(', ');
        const insertClipStmt = prodDb.prepare(`INSERT INTO Clip (${clipKeys.join(', ')}) VALUES (${clipPlaceholders})`);
        insertClipStmt.run(...Object.values(devClip));
        console.log(`[Migration] Inserted Clip ${targetClipId} into Prod`);

        // 4. Fetch Media records relating to this Clip from Dev
        const devMedia = devDb.prepare('SELECT * FROM Media WHERE referenceForClipId = ? OR resultForClipId = ?')
            .all(targetClipId, targetClipId) as any[];

        console.log(`[Migration] Found ${devMedia.length} Media records associated with Clip ${targetClipId}`);

        // 5. Insert Media into Prod
        if (devMedia.length > 0) {
            const mediaKeys = Object.keys(devMedia[0]);
            const mediaPlaceholders = mediaKeys.map(() => '?').join(', ');
            const insertMediaStmt = prodDb.prepare(`INSERT OR REPLACE INTO Media (${mediaKeys.join(', ')}) VALUES (${mediaPlaceholders})`);

            for (const media of devMedia) {
                insertMediaStmt.run(...Object.values(media));
            }
            console.log(`[Migration] Inserted ${devMedia.length} Media records into Prod`);
        }

        prodDb.prepare('COMMIT').run();
        console.log(`\n✅ Migration successfully entirely for Clip ${targetClipId} and its associated Media.`);
    } catch (err) {
        prodDb.prepare('ROLLBACK').run();
        console.error(`❌ Migration failed:`, err);
    } finally {
        devDb.close();
        prodDb.close();
    }
}

main();
