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
        const { clips } = await req.json(); // Expecting array of clips to check

        if (!clips || !Array.isArray(clips) || clips.length === 0) {
            return NextResponse.json({ message: 'No clips to poll' });
        }

        const sheets = await getSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;
        const updates: any[] = [];

        // Check each clip
        for (const clip of clips) {
            // We stored Task ID in Result URL (Column S) temporarily
            const taskId = clip.resultUrl;

            if (!taskId || taskId.startsWith('http')) continue; // Skip if no ID or already a URL

            console.log(`Polling Task ID: ${taskId} for Clip ${clip.id}`);

            // Call Kie.ai Status API
            // Based on legacy: https://api.kie.ai/api/v1/veo/record-info?taskId=...
            const kieRes = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!kieRes.ok) {
                console.error(`Kie.ai Poll Error for ${taskId}:`, kieRes.statusText);
                continue;
            }

            const kieData = await kieRes.json();
            console.log(`Poll Result for ${taskId}:`, kieData.data?.status);

            const status = kieData.data?.status; // 'COMPLETED', 'FAILED', 'PENDING'?
            const videoUrl = kieData.data?.videoUrl;

            if (status === 'COMPLETED' && videoUrl) {
                // Update Sheet
                // Row index in sheet = parseInt(clip.id) + 2 (assuming id is 0-based index)
                const sheetRow = parseInt(clip.id) + 2;

                // Update Status to 'Done'
                updates.push(sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `CLIPS!B${sheetRow}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [['Done']] }
                }));

                // Update Result URL
                updates.push(sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `CLIPS!S${sheetRow}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [[videoUrl]] }
                }));
            } else if (status === 'FAILED') {
                const sheetRow = parseInt(clip.id) + 2;
                updates.push(sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `CLIPS!B${sheetRow}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [['Error']] }
                }));
            }
        }

        await Promise.all(updates);

        return NextResponse.json({ success: true, checked: clips.length });

    } catch (error: any) {
        console.error('Poll error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
