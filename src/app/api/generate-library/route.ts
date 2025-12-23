
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createFluxTask, FluxPayload } from '@/lib/kie';

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
        const { item, rowIndex, style } = await req.json();

        if (!item || typeof rowIndex !== 'number') {
            return NextResponse.json({ error: 'Missing item or rowIndex' }, { status: 400 });
        }

        const sheets = await getSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // 1. Build Prompt
        // For Library items, it's just Name + Description + Style
        let prompt = `Photorealistic image of ${item.name}: ${item.description}.`;
        if (style) {
            prompt += ` Style: ${style}.`;
        }
        prompt += ` High quality, cinematic, detailed.`;

        console.log('Generated Library Flux Prompt:', prompt);

        // 2. Prepare Payload via Standard Factory (Flux Strategy)
        const payload: FluxPayload = {
            model: 'flux-2/flex-text-to-image',
            input: {
                prompt: prompt,
                aspect_ratio: '16:9',
                resolution: '2K'
            }
        };

        console.log('Library Flux Payload:', JSON.stringify(payload, null, 2));

        // 3. Call Kie.ai via Standard Client
        const kieRes = await createFluxTask(payload);

        // 4. Handle Response
        // Standard Factory returns { taskId, rawData }
        let resultUrl = '';
        if (kieRes.taskId) {
            resultUrl = `TASK:${kieRes.taskId}`;
        } else {
            // Try to find direct URL if sync?
            console.error('No Task ID returned:', kieRes);
        }

        const kieData = kieRes.rawData; // Maintain compatibility for response

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
