const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let value = match[2];
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        env[match[1]] = value;
    }
});

async function testWrite() {
    console.log('Testing Write Access...');
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        console.log('Writing to CLIPS!Z1...');
        await sheets.spreadsheets.values.update({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'CLIPS!Z1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Write Test Success']] },
        });

        console.log('Success! Check cell Z1 in your sheet.');
    } catch (error) {
        console.error('Write failed:', error.message);
        if (error.response) {
            console.error('Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testWrite();
