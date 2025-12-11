
const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

async function main() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Read first row
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'CLIPS!A1:Z1',
    });

    const headers = res.data.values ? res.data.values[0] : [];
    console.log('Clips Sheet Headers:');
    headers.forEach((h, i) => console.log(`${String.fromCharCode(65 + i)} (${i}): ${h}`));
}

main();
