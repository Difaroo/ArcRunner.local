import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, getHeaders, indexToColumnLetter } from '@/lib/sheets';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

export async function POST(request: Request) {
    try {
        const { updates } = await request.json(); // updates: { id: string, sortOrder: number }[]

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: 'Invalid updates format' }, { status: 400 });
        }

        const sheets = await getGoogleSheetsClient();
        const headers = await getHeaders('CLIPS');
        const sortOrderColIndex = headers.get('Sort Order');

        if (sortOrderColIndex === undefined) {
            return NextResponse.json({ error: 'Sort Order column not found' }, { status: 500 });
        }

        const colLetter = indexToColumnLetter(sortOrderColIndex);

        const data = updates.map((update: any) => ({
            range: `CLIPS!${colLetter}${parseInt(update.id) + 2}`, // id is 0-based index from data rows (row 2+)
            values: [[update.sortOrder]]
        }));

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: data
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Sort API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
