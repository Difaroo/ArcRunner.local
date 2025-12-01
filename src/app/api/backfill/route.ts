import { NextResponse } from 'next/server';
import { google } from 'googleapis';

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

        // 1. Read Library Data (A:F)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'LIBRARY!A2:F', // Skip header
        });

        const rows = response.data.values || [];
        const updates = [];
        let currentEpisode = 1;

        // 2. Iterate and Calculate Episodes
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const isEmpty = !row || row.length === 0 || row.every(cell => !cell);

            if (isEmpty) {
                // Gap found! Increment episode for NEXT items
                currentEpisode++;
                // Don't write anything for the empty row itself
            } else {
                // Content found! Assign current episode
                // We need to write to Column G (Index 6). 
                // Row index in sheet = i + 2 (because we started at A2)
                updates.push({
                    range: `LIBRARY!G${i + 2}`,
                    values: [[currentEpisode.toString()]]
                });
            }
        }

        // 3. Batch Update
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
