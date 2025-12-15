
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 1. Env & Setup
const loadEnv = (file: string) => {
    const p = path.resolve(process.cwd(), file);
    if (fs.existsSync(p)) {
        console.log(`Loading ${file}...`);
        dotenv.config({ path: p });
    }
};


loadEnv('.env.local');
loadEnv('.env');

const db = new PrismaClient();

// 2. Helpers
async function getAuthClient() {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        console.error('Env vars missing!');
        console.log('Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
        console.log('Key:', process.env.GOOGLE_PRIVATE_KEY ? 'Present (len ' + process.env.GOOGLE_PRIVATE_KEY.length + ')' : 'Missing');
        throw new Error('Missing Google Service Account Env Vars');
    }
    const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    console.log('Key formatted length:', key.length);
    const client = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    await client.authorize();
    return client;
}

const parseHeaders = (rows: any[][]) => {
    const headerRow = rows[0];
    const map = new Map<string, number>();
    headerRow.forEach((h, i) => map.set(String(h).trim(), i));
    return map;
};

const getVal = (row: any[], map: Map<string, number>, col: string) => {
    const idx = map.get(col);
    if (idx === undefined) return undefined;
    const val = row[idx];
    return val ? String(val).trim() : undefined;
};

// 3. Main Update Logic
async function main() {
    console.log('🚀 Starting Targeted Update: Studio Item Negatives');

    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID missing');

    // A. Connect Google Sheets
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('Fetching LIBRARY sheet...');
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'LIBRARY!A1:ZZ',
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) {
        console.error('No rows found in LIBRARY sheet.');
        return;
    }

    const headers = parseHeaders(rows);
    console.log('Headers:', Array.from(headers.keys()));

    if (!headers.has('Negatives')) {
        console.error('CRITICAL: "Negatives" column not found in Sheet!');
        return;
    }

    // B. Fetch DB Context (Series Map)
    // We assume Series # in sheet maps to Series in DB.
    // Ideally we'd map "1" -> SeriesUUID. 
    // Since we don't have the original map, we'll try to match by Series Name if possible, 
    // OR just fetch all series and try to infer or assume "1" is the first one?
    // Actually, getting Series from DB is safer.
    // Let's list series.
    const dbSeries = await db.series.findMany();
    // Create a map? The sheet calls them "1", "2".
    // Does the DB Series have a "number" field? No.
    // However, existing items *have* a seriesId.
    // We can match Items by Name + Episode + (Implicit Series).

    // Better strategy:
    // Iterate through Sheet Rows.
    // For each row:
    //   Name, Episode.
    //   Find StudioItem in DB where name=Name AND episode=Episode.
    //   (Maybe verify Series count?)
    //   Update negatives.

    console.log('Iterating rows and updating DB...');
    let updatedCount = 0;
    let skippedCount = 0;
    let missingCount = 0;

    // Skip header
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = getVal(row, headers, 'Name');
        const episode = getVal(row, headers, 'Episode') || '1'; // Default to 1 if missing?
        const negatives = getVal(row, headers, 'Negatives');
        const type = getVal(row, headers, 'Type');

        if (!name || name === 'Name') continue;

        // Find existing item(s)
        // Note: Name might not be unique across ALL series, but usually is within a project.
        // We'll filter by name and episode first.
        const existingItems = await db.studioItem.findMany({
            where: {
                name: name,
                episode: episode
            }
        });

        if (existingItems.length === 0) {
            // Try matching just by Name (incase Episode format differs)
            const existingByName = await db.studioItem.findMany({
                where: { name: name }
            });

            if (existingByName.length === 1) {
                // High confidence match
                await updateItem(existingByName[0], negatives);
                continue;
            }

            // check heuristics?
            // "1" vs "01"?
            // console.warn(`  [${i}] Item not found: ${name} (Ep: ${episode})`);
            missingCount++;
            continue;
        }

        // We have matches.
        for (const item of existingItems) {
            await updateItem(item, negatives);
        }
    }

    async function updateItem(item: any, newVal: string | undefined) {
        if (!newVal) {
            skippedCount++;
            return; // nothing to update
        }

        // Clean the value (remove "1" if it was the corruption)
        // Wait, the user said "I've restored the negatives". So the sheet value IS the good value.
        // Even if it is empty string? 
        // If sheet has empty string, should we wipe DB? Yes, strict sync.

        // Check if different?
        if (item.negatives === newVal) {
            skippedCount++;
            return;
        }

        await db.studioItem.update({
            where: { id: item.id },
            data: { negatives: newVal }
        });
        console.log(`  Updated [${item.name}]: "${newVal.substring(0, 20)}..."`);
        updatedCount++;
    }

    console.log('------------------------------------------------');
    console.log(`Update Complete.`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (No change/Empty): ${skippedCount}`);
    console.log(`Missing in DB: ${missingCount}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => db.$disconnect());
