import { google } from 'googleapis';


// --- Config ---
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

export async function getAuthClient() {
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
}

export async function getGoogleSheetsClient() {
    const authClient = await getAuthClient();
    return google.sheets({ version: 'v4', auth: authClient as any });
}

export async function getSheetData(range: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const sheets = await getGoogleSheetsClient();

            console.log(`Fetching range: ${range} (Attempt ${i + 1}/${retries})`);
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range,
                valueRenderOption: 'FORMATTED_VALUE',
            });
            console.log('Sheets API response status:', response.status);

            return response.data.values;
        } catch (error: any) {
            console.error(`Error fetching sheet data (Attempt ${i + 1}/${retries}):`, error.message);
            if (i === retries - 1) throw error; // Throw on last attempt
            // Wait before retrying (1s, 2s, 4s)
            await new Promise(res => setTimeout(res, 1000 * Math.pow(2, i)));
        }
    }
}

/**
 * Fetches the first row of a sheet to map Header Names to Column Indices.
 * Returns a Map<HeaderName, ColumnIndex>.
 */
export async function getHeaders(sheetName: string): Promise<Map<string, number>> {
    try {
        const rows = await getSheetData(`${sheetName}!1:1`);
        if (!rows || rows.length === 0) return new Map();

        const headers = rows[0];
        const headerMap = new Map<string, number>();

        headers.forEach((header: string, index: number) => {
            if (header) {
                headerMap.set(header.trim(), index);
            }
        });

        return headerMap;
    } catch (error) {
        console.error(`Error fetching headers for ${sheetName}:`, error);
        return new Map();
    }
}

/**
 * Converts a 0-based column index to a Google Sheets column letter (e.g., 0 -> A, 26 -> AA).
 */
export function indexToColumnLetter(index: number): string {
    let temp, letter = '';
    while (index >= 0) {
        temp = (index) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        index = (index - temp - 1) / 26 - 1; // Adjust for 0-based index
        if (index < 0) break; // Break if we've processed all
    }
    return letter;
}
