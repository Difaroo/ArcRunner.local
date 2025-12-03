import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, getHeaders, indexToColumnLetter } from '@/lib/sheets';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

export async function POST(request: Request) {
    try {
        const { rowIndex, updates } = await request.json();

        if (rowIndex === undefined || !updates) {
            return NextResponse.json({ error: 'Missing rowIndex or updates' }, { status: 400 });
        }

        // Calculate actual row number (0-indexed array + 2 for header and 1-based sheet)
        // clipsRows starts at A2. So index 0 is Row 2.
        const sheetRow = parseInt(rowIndex) + 2;

        const sheets = await getGoogleSheetsClient();

        // Fetch Headers dynamically
        const headers = await getHeaders('CLIPS');

        // Helper to get column letter for a field
        const getColLetter = (headerName: string) => {
            const index = headers.get(headerName);
            return index !== undefined ? indexToColumnLetter(index) : null;
        };

        // Map field names to Header Names
        const fieldToHeader: Record<string, string> = {
            status: 'Status',
            title: 'Title',
            character: 'Character',
            location: 'Location',
            style: 'Style',
            camera: 'Camera',
            action: 'Action',
            dialog: 'Dialog',
            refImageUrls: 'Ref Image URLs',
            seed: 'Seed',
            resultUrl: 'Result URL', // Added just in case
        };

        const updatePromises = Object.entries(updates).map(([field, value]) => {
            const headerName = fieldToHeader[field];
            if (!headerName) return null;

            const colLetter = getColLetter(headerName);
            if (!colLetter) {
                console.warn(`Column for field '${field}' (Header: '${headerName}') not found in CLIPS sheet.`);
                return null;
            }

            return sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `CLIPS!${colLetter}${sheetRow}`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[value]],
                },
            });
        });

        await Promise.all(updatePromises.filter(Boolean));

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Update Clip Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
