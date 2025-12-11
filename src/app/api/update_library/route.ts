import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, getHeaders, indexToColumnLetter } from '@/lib/sheets';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

export async function POST(request: Request) {
    try {
        const { rowIndex, updates } = await request.json();

        if (rowIndex === undefined || !updates) {
            return NextResponse.json({ error: 'Missing rowIndex or updates' }, { status: 400 });
        }

        // Calculate Sheet Row Number (1-based)
        // rowIndex comes from the array index, so row 0 is actually Row 2 in Sheet (Header is Row 1)
        const sheetRow = parseInt(rowIndex) + 2;

        const sheets = await getGoogleSheetsClient();

        // Fetch Headers dynamically
        const headers = await getHeaders('LIBRARY');

        // Helper to get column letter for a field
        const getColLetter = (headerName: string) => {
            const index = headers.get(headerName);
            return index !== undefined ? indexToColumnLetter(index) : null;
        };

        // Dynamically find the Ref Image header
        const refHeader = ['Ref Image URLs', 'Ref Image URL', 'Ref Images', 'Ref Image'].find(h => headers.has(h)) || 'Ref Image URLs';

        // Map field names to Header Names
        const fieldToHeader: Record<string, string> = {
            type: 'Type',
            name: 'Name',
            description: 'Description',
            refImageUrl: refHeader,
            negatives: 'Negatives',
            notes: 'Notes',
            episode: 'Episode', // Fallback, not always standard
            series: 'Series'
        };

        // Construct batch update requests
        const data = [];

        for (const [field, value] of Object.entries(updates)) {
            const headerName = fieldToHeader[field];
            if (headerName) {
                const colLetter = getColLetter(headerName);
                if (colLetter) {
                    data.push({
                        range: `LIBRARY!${colLetter}${sheetRow}`,
                        values: [[value]]
                    });
                } else {
                    console.warn(`Column for field '${field}' (Header: '${headerName}') not found in LIBRARY sheet.`);
                }
            }
        }

        if (data.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: data
                }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Update Library Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
