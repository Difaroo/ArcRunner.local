import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Helper to get authenticated sheets client
async function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
}

export async function POST(req: Request) {
    try {
        const { clips, library } = await req.json();
        const sheets = await getSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        let clipsCount = 0;
        let libraryCount = 0;

        // 1. Append CLIPS
        if (clips && clips.length > 0) {
            const clipRows = clips.map((c: any) => [
                c['Scene #'] || '',      // A: Scene #
                '',                      // B: Status (Blank)
                c['Title'] || '',        // C: Title
                c['Characters'] || '',   // D: Characters
                '',                      // E: Pick Character (Blank)
                c['Location'] || '',     // F: Location
                c['Style'] || '',        // G: Style
                c['Camera'] || '',       // H: Camera
                c['Action'] || '',       // I: Action
                c['Dialog'] || '',       // J: Dialog
                c['Ref Image URLs'] || '', // K: Ref Image URLs
                c['Ref Video URL'] || '',  // L: Ref Video URL
                '',                      // M: Seed
                c['DurationSec'] || '4', // N: DurationSec
                c['Quality'] || 'fast',  // O: Quality
                '9:16',                  // P: Ratio
                c['Negatives'] || '',    // Q: Negatives
                '',                      // R: Prompt
                '',                      // S: Result URL
                '',                      // T: Log
                'kie_api'                // U: Service
            ]);

            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'CLIPS!A:U', // Append to columns A-U
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: clipRows },
            });
            clipsCount = clips.length;
        }

        // 2. Append LIBRARY
        if (library && library.length > 0) {
            const libraryRows = library.map((l: any) => [
                l['Type'] || '',        // A: Type
                l['Name'] || '',        // B: Name
                l['Description'] || '', // C: Description
                l['Ref Image URLs'] || '', // D: Ref Image URLs
                l['Negatives'] || '',   // E: Negatives
                l['Notes'] || ''        // F: Notes
            ]);

            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'LIBRARY!A:F', // Append to columns A-F
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: libraryRows },
            });
            libraryCount = library.length;
        }

        return NextResponse.json({ success: true, clipsCount, libraryCount });
    } catch (error: any) {
        console.error('Save error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
