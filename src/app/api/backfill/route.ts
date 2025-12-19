import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getHeaders, indexToColumnLetter } from '@/lib/sheets';

// --- Auth Helper (Duplicated to avoid import issues for temp script) ---
async function getAuthClient() {
    const client = new google.auth.JWT(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        undefined,
        (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets']
    );
    await client.authorize();
    return client;
}

export async function GET() {
    try {
        const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
        if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID missing');

        const authClient = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient as any });

        // 1. Read Library Data (Including Headers)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'LIBRARY!A1:ZZ', // Read all columns including header
        });

        const allRows = response.data.values || [];

        // 2. Parse Headers
        const headers = getHeaders(allRows);
        const episodeColIndex = headers.get('Episode');

        if (episodeColIndex === undefined) {
            throw new Error('Episode column not found in LIBRARY sheet');
        }

        const episodeColLetter = indexToColumnLetter(episodeColIndex);

        // 3. Process Rows (Skip Header)
        const rows = allRows.slice(1);
        const updates = [];
        let currentEpisode = 1;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const isEmpty = !row || row.length === 0 || row.every(cell => !cell);

            if (isEmpty) {
                // Gap found! Increment episode for NEXT items
                currentEpisode++;
            } else {
                // Content found! Assign current episode
                // Note: i is index in rows (0-based), so spreadsheet row is i + 2 (header + 1-based)
                updates.push({
                    range: `LIBRARY!${episodeColLetter}${i + 2}`,
                    values: [[currentEpisode.toString()]]
                });
            }
        }

        // 4. Batch Update
        if (updates.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: updates
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: `Backfilled ${updates.length} rows across ${currentEpisode} episodes.`
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
