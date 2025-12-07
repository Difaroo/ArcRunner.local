import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { buildPrompt } from '@/lib/promptBuilder';

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
        const { clip, rowIndex, model: requestedModel, aspectRatio: requestedRatio } = await req.json();

        if (!clip || typeof rowIndex !== 'number') {
            return NextResponse.json({ error: 'Missing clip or rowIndex' }, { status: 400 });
        }

        const sheets = await getSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // 1. Fetch Library Data (for prompt building)
        const libRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'LIBRARY!A2:F',
        });
        const libraryRows = libRes.data.values || [];
        const libraryItems = libraryRows.map(row => ({
            type: row[0],
            name: row[1],
            description: row[2],
            refImageUrl: row[3]
        }));

        // 2. Build Prompt
        const prompt = buildPrompt(clip, libraryItems);
        // Flux specific: Add "Film Still" or similar if not present to ensure cinematic quality? 
        // For now, let's stick to the raw prompt but maybe append a style hint if not strictly defined.

        console.log('Generated Flux Prompt:', prompt);

        // 3. Prepare Payload
        let model = 'flux-kontext-pro';
        if (requestedModel === 'flux-flex') {
            model = 'flux-kontext-flex';
        }

        const aspectRatio = requestedRatio || '16:9';

        const payload = {
            prompt: prompt,
            model: model,
            aspectRatio: aspectRatio,
            enableTranslation: true,
            // safetyTolerance: 'ALLOW_ALL' // Optional: if needed to override strict safety
        };

        console.log('Flux Payload:', JSON.stringify(payload, null, 2));

        // 4. Call Kie.ai Flux API
        // Endpoint verified via search: https://api.kie.ai/api/v1/flux/kontext/generate
        const kieRes = await fetch('https://api.kie.ai/api/v1/flux/kontext/generate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const kieData = await kieRes.json();
        console.log('Kie.ai Flux Response:', JSON.stringify(kieData, null, 2));

        if (!kieRes.ok) {
            throw new Error(kieData.error?.message || JSON.stringify(kieData) || 'Failed to call Kie.ai Flux');
        }

        // 5. Handle Response
        // Flux API usually returns a task ID or direct data.
        // Assuming it works like Veo and returns a `taskId` to poll, OR a direct `data.imageUrl` if fast.
        // Documentation says "Generated images are stored for 14 days", implying a URL is returned or retrieved.
        // Common pattern for image gen is sync or fast-async.

        // Let's assume it returns a Task ID for consistency with Veo, or check for `data.images` array.
        // If sync: kieData.data[0].url
        // If async: kieData.data.taskId

        let resultUrl = '';
        let status = 'Generating';

        if (kieData.data && kieData.data.images && kieData.data.images.length > 0) {
            // Synchronous return
            resultUrl = kieData.data.images[0].url;
            status = 'Done';
        } else if (kieData.data && kieData.data.taskId) {
            // Asynchronous return
            resultUrl = kieData.data.taskId; // Store ID to poll later
            status = 'Generating';
        } else if (kieData.data && kieData.data.url) {
            // Single URL return
            resultUrl = kieData.data.url;
            status = 'Done';
        }

        // 6. Update Sheet
        const sheetRow = rowIndex + 2;

        const updates = [
            sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `CLIPS!B${sheetRow}`, // Status
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[status]] }
            }),
            sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `CLIPS!S${sheetRow}`, // Result URL
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[resultUrl]] }
            })
        ];

        await Promise.all(updates);

        return NextResponse.json({ success: true, data: kieData });

    } catch (error: any) {
        console.error('Flux Generate Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
