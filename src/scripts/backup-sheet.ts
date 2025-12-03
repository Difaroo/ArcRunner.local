
import fs from 'fs';
import path from 'path';
import { getSheetData } from '../lib/sheets';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

async function backup() {
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
