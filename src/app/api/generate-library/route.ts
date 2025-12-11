
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Helper to get authenticated sheets client - DUPLICATE from generate-image (should refactor to lib)
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
        const { item, rowIndex } = await req.json();

        if (!item || typeof rowIndex !== 'number') {
            return NextResponse.json({ error: 'Missing item or rowIndex' }, { status: 400 });
        }

        const sheets = await getSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // 1. Build Prompt
        // For Library items, it's just Name + Description (maybe Type too)
        const prompt = `Photorealistic image of ${item.name}: ${item.description}. High quality, cinematic, detailed.`;

        console.log('Generated Library Flux Prompt:', prompt);

        // 2. Prepare Payload (Use verified model ID)
        const payload = {
            model: 'flux-2/flex-text-to-image',
            input: {
                prompt: prompt,
                aspect_ratio: '16:9',
                resolution: '2K' // Required by this model
            }
        };

        console.log('Library Flux v1/jobs Payload:', JSON.stringify(payload, null, 2));

        // 3. Call Kie.ai v1/jobs API
        const kieRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const kieData = await kieRes.json();

        if (!kieRes.ok) {
            throw new Error(kieData.error?.message || 'Failed to call Kie.ai Flux');
        }

        // 4. Handle Response
        let resultUrl = '';

        if (kieData.data && kieData.data.taskId) {
            resultUrl = `TASK:${kieData.data.taskId}`;
        } else {
            // Fallback/Error logging if no ID
            console.error('No Task ID returned from v1/jobs:', kieData);
        }

        // 5. Update Sheet immediately (assuming Sync result for now)
        // Library Sheet Structure: Dynamically find column
        const headerRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'LIBRARY!1:1',
        });
        const headers = headerRes.data.values?.[0] || [];
        const refImageColIndex = headers.indexOf('Ref Image URLs');

        if (refImageColIndex === -1) {
            throw new Error('Could not find "Ref Image URLs" column in LIBRARY sheet');
        }

        const refImageColLetter = String.fromCharCode(65 + refImageColIndex); // 0=A, ... (Simple version for <26 cols)

        const sheetRow = rowIndex + 2;

        // Handle Async Task ID
        if (kieData.data?.taskId && !resultUrl) {
            resultUrl = `TASK:${kieData.data.taskId}`;
        }

        if (resultUrl) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `LIBRARY!${refImageColLetter}${sheetRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[resultUrl]] }
            });
        }

        return NextResponse.json({ success: true, data: kieData, resultUrl });

    } catch (error: any) {
        console.error('Library Generate Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
