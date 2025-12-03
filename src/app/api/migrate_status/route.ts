import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/sheets';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

export async function GET() {
    try {
        const sheets = await getGoogleSheetsClient();

        // Fetch all data from CLIPS sheet
        // Columns: A=Scene, B=Status, ..., T=ResultUrl (Index 19)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CLIPS!A2:Z', // Fetch enough columns
        });

        const rows = response.data.values;
        if (!rows) {
            return NextResponse.json({ message: 'No rows found' });
        }

        const updates: { range: string; values: string[][] }[] = [];
        let updatedCount = 0;

        rows.forEach((row, index) => {
            const rowIndex = index + 2; // 1-based index, + header row
            const status = row[1] || '';
            const resultUrl = row[19] || ''; // Column T is index 19

            let newStatus = null;

            if (resultUrl && resultUrl.trim() !== '') {
                // Has URL
                if (status === 'Done') {
                    newStatus = 'Ready';
                } else if (status === '' || status === 'Generating' || status === 'Error') {
                    // Should be Ready if it has a URL?
                    // Maybe 'Generating' with URL means it finished but status wasn't updated?
                    // Safer to set to Ready.
                    newStatus = 'Ready';
                }
                // If 'Saved' or 'Ready', leave it.
            } else {
                // No URL
                if (status !== '' && status !== 'Error') {
                    // If it says Done/Ready/Generating/Saved but has no URL -> Clear it
                    // Exception: Maybe 'Generating' is legit?
                    // User said: "stuck" clips (Done + No URL).
                    // If 'Generating', we should probably leave it? Or user said "stuck from previous session".
                    // If it's been generating for hours, it's stuck.
                    // Let's clear 'Done', 'Ready', 'Saved' if no URL.
                    // Let's also clear 'Generating' if user wants to clean up.
                    // User request: "Done + No URL -> Empty".
                    newStatus = '';
                }
            }

            if (newStatus !== null && newStatus !== status) {
                updates.push({
                    range: `CLIPS!B${rowIndex}`,
                    values: [[newStatus]],
                });
                updatedCount++;
            }
        });

        if (updates.length > 0) {
            // Batch update
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: 'RAW',
                    data: updates,
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: `Migrated ${updatedCount} rows.`,
            updates: updates.length
        });

    } catch (error: any) {
        console.error('Migration Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
