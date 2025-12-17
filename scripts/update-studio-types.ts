
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
        throw new Error('Missing Google Service Account Env Vars');
    }
    const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
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

// 3. Mapping Definitions
const TYPE_MAPPING: Record<string, string> = {
    'Character': 'LIB_CHARACTER',
    'Location': 'LIB_LOCATION',
    'Style': 'LIB_STYLE',
    'Camera': 'LIB_CAMERA',
    'Action': 'LIB_ACTION',
    'Object': 'LIB_OBJECT',
    'Prop': 'LIB_OBJECT', // Alias just in case
};

const DEFAULT_TYPE = 'LIB_OTHER';

function mapType(sheetValue: string | undefined): string {
    if (!sheetValue) return DEFAULT_TYPE;
    if (sheetValue.trim().startsWith('LIB_')) return sheetValue.trim();

    // Normalize: Title Case or UPPER CASE match?
    // Sheet is likely "Character", "Location" etc. 
    // But let's be robust:

    // 1. Exact match
    if (TYPE_MAPPING[sheetValue]) return TYPE_MAPPING[sheetValue];

    // 2. Case insensitive match?
    const lower = sheetValue.toLowerCase();
    for (const [k, v] of Object.entries(TYPE_MAPPING)) {
        if (k.toLowerCase() === lower) return v;
    }

    // 3. Fallback
    return DEFAULT_TYPE;
}

// 4. Main Update Logic
async function main() {
    console.log('🚀 Starting Targeted Update: Studio Item Types');

    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID missing');

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
    if (!headers.has('Type')) {
        console.error('CRITICAL: "Type" column not found in Sheet!');
        return;
    }

    console.log('Iterating rows and reconciling Types...');
    let updatedCount = 0;
    let skippedCount = 0;
    let missingCount = 0;

    // Skip header
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = getVal(row, headers, 'Name');
        const episode = getVal(row, headers, 'Episode') || '1';
        const rawType = getVal(row, headers, 'Type');

        if (!name || name === 'Name') continue;

        const targetType = mapType(rawType);

        // Find existing item(s) by Name + Episode
        const existingItems = await db.studioItem.findMany({
            where: {
                name: name,
                episode: episode
            }
        });

        if (existingItems.length === 0) {
            // Try matching just by Name as fallback
            const existingByName = await db.studioItem.findMany({
                where: { name: name }
            });

            if (existingByName.length === 1) {
                await updateItemType(existingByName[0], targetType, rawType);
                continue;
            }

            missingCount++;
            continue;
        }

        // We have matches
        for (const item of existingItems) {
            await updateItemType(item, targetType, rawType);
        }
    }

    async function updateItemType(item: any, newType: string, originalSheetValue: string | undefined) {
        if (item.type === newType) {
            skippedCount++;
            return;
        }

        await db.studioItem.update({
            where: { id: item.id },
            data: { type: newType }
        });
        console.log(`  Updated [${item.name}]: ${item.type} -> ${newType} (Sheet: "${originalSheetValue}")`);
        updatedCount++;
    }

    console.log('------------------------------------------------');
    console.log(`Sync Complete.`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (Already correct): ${skippedCount}`);
    console.log(`Missing in DB: ${missingCount}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => db.$disconnect());
