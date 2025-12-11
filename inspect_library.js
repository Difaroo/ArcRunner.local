
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

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'LIBRARY!A2:F',
    });

    const rows = res.data.values || [];
    console.log(`Found ${rows.length} library items.`);

    // Headers: Series(0), Episode(1), Type(2), Name(3), Desc(4), Ref(5)
    rows.forEach((row, i) => {
        const series = row[0];
        const type = row[2];
        const name = row[3];
        const ref = row[5];

        if (type === 'LIB_CHARACTER' || type === 'LIB_LOCATION') {
            console.log(`[${series}] ${type} "${name}": ${ref ? ref.substring(0, 50) + '...' : 'NONE'}`);
            if (ref && !ref.startsWith('http')) {
                console.log(`POOR URL DETECTED for above item: ${ref}`);
            }
        }
    });
}

main();
