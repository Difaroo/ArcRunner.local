const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local to avoid dependencies
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let value = match[2];
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }
        env[match[1]] = value;
    }
});

async function testConnection() {
    console.log('Testing connection...');
    console.log('Service Account:', env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.log('Spreadsheet ID:', env.SPREADSHEET_ID);

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        console.log('Attempting to fetch data...');
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: env.SPREADSHEET_ID,
            range: 'CLIPS!A2:Z',
        });

        console.log('Success!');
        console.log('Rows found:', response.data.values ? response.data.values.length : 0);
    } catch (error) {
        console.error('Connection failed:', error.message);
        if (error.response) {
            console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testConnection();
