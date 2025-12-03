
import dotenv from 'dotenv';
import path from 'path';

// Load env vars BEFORE importing lib/sheets
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Loading env from:', envPath);
const result = dotenv.config({ path: envPath });
if (result.error) console.error('Dotenv error:', result.error);

console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'FOUND' : 'MISSING');

import fs from 'fs';

async function backup() {
    // Dynamic import to ensure env vars are loaded first
    const { getSheetData } = await import('../lib/sheets');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups', timestamp);

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`Backing up to: ${backupDir}`);

    const sheets = ['CLIPS', 'LIBRARY', 'EPISODES', 'SERIES'];

    for (const sheetName of sheets) {
        try {
            console.log(`Fetching ${sheetName}...`);
            const data = await getSheetData(`${sheetName}!A1:ZZ`);

            if (data) {
                const filePath = path.join(backupDir, `${sheetName}.json`);
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                console.log(`Saved ${sheetName}.json`);
            } else {
                console.warn(`No data found for ${sheetName}`);
            }
        } catch (error) {
            console.error(`Failed to backup ${sheetName}:`, error);
        }
    }

    console.log('Backup complete!');
}

backup().catch(console.error);
