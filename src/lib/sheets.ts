import { google } from 'googleapis';

export async function getSheetData(range: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            const sheets = google.sheets({ version: 'v4', auth });

            console.log(`Fetching range: ${range} (Attempt ${i + 1}/${retries})`);
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: process.env.SPREADSHEET_ID,
                range,
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
