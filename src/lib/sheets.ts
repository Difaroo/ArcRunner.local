import { google } from 'googleapis';

export function parseHeaders(data: any[][]): Map<string, number> {
    const headers = new Map<string, number>();
    if (!data || data.length === 0) return headers;
    const headerRow = data[0];
    headerRow.forEach((h: any, i: number) => {
        if (h) headers.set(String(h).trim(), i);
    });
    return headers;
}

export async function getSheetData(range: string): Promise<any[][] | null | undefined> {
    const sheetId = process.env.SPREADSHEET_ID;
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;

    if (!sheetId || !email || !key) {
        console.warn(`Missing Env Vars: SheetID=${!!sheetId}, Email=${!!email}, Key=${!!key}`);
        throw new Error("Missing Google Sheets credentials");
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: email,
                private_key: key.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range,
        });

        return response.data.values;

    } catch (error: any) {
        console.error(`Failed to fetch sheet range ${range}:`, error.message);
        throw error;
    }
}
