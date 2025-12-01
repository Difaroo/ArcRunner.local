import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// --- Config ---
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

// --- Helper: Get Auth Client ---
const getAuthClient = async () => {
    if (!CLIENT_EMAIL || !PRIVATE_KEY) {
        throw new Error('Missing Google Service Account credentials');
    }
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: CLIENT_EMAIL,
            private_key: PRIVATE_KEY,
        },
        scopes: SCOPES,
    });
    return await auth.getClient();
};

export async function POST(request: Request) {
    try {
        const { rowIndex, updates } = await request.json();

        if (rowIndex === undefined || !updates) {
            return NextResponse.json({ error: 'Missing rowIndex or updates' }, { status: 400 });
        }

        // Calculate Sheet Row Number (1-based)
        // rowIndex comes from the array index, so row 0 is actually Row 2 in Sheet (Header is Row 1)
        const sheetRow = parseInt(rowIndex) + 2;

        const authClient = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient as any });

        // Map updates to columns
        // A: Type, B: Name, C: Description, D: RefImage, E: Negatives, F: Notes
        // We only update specific cells to avoid overwriting others if partial

        // Construct batch update requests
        const data = [];

        if (updates.type !== undefined) data.push({ range: `LIBRARY!A${sheetRow}`, values: [[updates.type]] });
        if (updates.name !== undefined) data.push({ range: `LIBRARY!B${sheetRow}`, values: [[updates.name]] });
        if (updates.description !== undefined) data.push({ range: `LIBRARY!C${sheetRow}`, values: [[updates.description]] });
        if (updates.refImageUrl !== undefined) data.push({ range: `LIBRARY!D${sheetRow}`, values: [[updates.refImageUrl]] });
        if (updates.negatives !== undefined) data.push({ range: `LIBRARY!E${sheetRow}`, values: [[updates.negatives]] });
        if (updates.notes !== undefined) data.push({ range: `LIBRARY!F${sheetRow}`, values: [[updates.notes]] });
        // G: Episode is usually not edited, but could be added if needed

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
