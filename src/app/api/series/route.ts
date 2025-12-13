import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getSheetData, parseHeaders } from '@/lib/sheets';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

export async function POST(request: Request) {
    try {
        const { title } = await request.json();

        if (!title) {
            return NextResponse.json({ error: 'Missing title' }, { status: 400 });
        }

        const sheets = await getGoogleSheetsClient();

        // 1. Get Headers to map columns
        const headers = await getHeaders('SERIES');
        const maxColIndex = Math.max(...Array.from(headers.values()));

        // 2. Fetch existing rows to calculate next ID
        // We can re-use getSheetData logic or just fetch columns A:A
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'SERIES!A:A', // Assuming ID is in column A
        });

        const rows = response.data.values || [];
        // Filter out header 'Series #' and parse IDs
        const existingIds = rows
            .map(row => parseInt(row[0]))
            .filter(id => !isNaN(id));

        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

        // 3. Prepare New Row
        const row = new Array(maxColIndex + 1).fill('');

        // Map fields
        const setVal = (header: string, val: string | number) => {
            const idx = headers.get(header);
            if (idx !== undefined) row[idx] = val.toString();
        };

        setVal('Series #', nextId);
        setVal('Title', title);
        setVal('Total Episodes', '0');
        setVal('Status', 'Active');

        // 4. Append
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'SERIES!A:ZZ',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [row] },
        });

        return NextResponse.json({ success: true, id: nextId.toString(), title });

    } catch (error: any) {
        console.error('Add Series Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
