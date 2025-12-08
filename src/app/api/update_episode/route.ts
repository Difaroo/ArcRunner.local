import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, getHeaders, indexToColumnLetter } from '@/lib/sheets';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

export async function POST(request: Request) {
    try {
        const { seriesId, episodeId, updates } = await request.json();

        if (!seriesId || !episodeId || !updates) {
            return NextResponse.json({ error: 'Missing seriesId, episodeId, or updates' }, { status: 400 });
        }

        const sheets = await getGoogleSheetsClient();

        // 1. Find the Episode Row
        const epHeaders = await getHeaders('EPISODES');
        const epResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'EPISODES!A:ZZ',
        });

        const rows = epResponse.data.values || [];
        const serIdx = epHeaders.get('Series');
        const epIdx = epHeaders.get('Episode');

        if (serIdx === undefined || epIdx === undefined) {
            return NextResponse.json({ error: 'Series/Episode columns not found' }, { status: 500 });
        }

        // Find row index (0-based in array => 1-based in Sheet)
        // Header is row 1. Data starts row 2. Array index 0 is Row 1 (Header).
        // Actually `values.get` returns headers as first row usually if A1 notation.
        // Let's assume Row 0 is header.

        let rowIndex = -1;

        // We iterate starting from 1 (skipping header)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[serIdx]?.toString().trim() === seriesId.toString() &&
                row[epIdx]?.toString().trim() === episodeId.toString()) {
                rowIndex = i + 1; // 1-based sheet row
                break;
            }
        }

        if (rowIndex === -1) {
            return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
        }

        // 2. Perform Updates
        const updatePromises = Object.entries(updates).map(([field, value]) => {
            // Map 'model' -> 'Model' (Case sensitivity?)
            // Let's assume keys passed match Header Names or simple mapping
            let headerName = field;
            if (field === 'model') headerName = 'Model';
            if (field === 'title') headerName = 'Title';

            const colIndex = epHeaders.get(headerName);
            if (colIndex === undefined) return null;

            const colLetter = indexToColumnLetter(colIndex);

            return sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `EPISODES!${colLetter}${rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[value]],
                },
            });
        });

        await Promise.all(updatePromises.filter(Boolean));

        return NextResponse.json({ success: true, rowIndex });

    } catch (error: any) {
        console.error('Update Episode Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
