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

        // Calculate actual row number (0-indexed array + 2 for header and 1-based sheet)
        // Wait, the 'id' in our app is the index in the 'clipsRows' array.
        // clipsRows starts at A2. So index 0 is Row 2.
        const sheetRow = parseInt(rowIndex) + 2;

        const authClient = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient as any });

        // Map field names to Column letters
        const columnMap: Record<string, string> = {
            title: 'C',
            character: 'D',
            location: 'F',
            style: 'G',
            camera: 'H',
            action: 'I',
            dialog: 'J',
        };

        const updatePromises = Object.entries(updates).map(([field, value]) => {
            const col = columnMap[field];
            if (!col) return null;

            return sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `CLIPS!${col}${sheetRow}`,
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
