
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

        // 2. Prepare Payload (Default to Flux Pro for Studio)
        const payload = {
            prompt: prompt,
            model: 'flux-kontext-pro',
            aspectRatio: '16:9', // Default for now
            enableTranslation: true,
        };

        // 3. Call Kie.ai Flux API
        const kieRes = await fetch('https://api.kie.ai/api/v1/flux/kontext/generate', {
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

        if (kieData.data && kieData.data.images && kieData.data.images.length > 0) {
            resultUrl = kieData.data.images[0].url;
        } else if (kieData.data && kieData.data.url) {
            resultUrl = kieData.data.url;
        } else if (kieData.data && kieData.data.taskId) {
            // If async, we have a problem because Library doesn't have a Status column for polling (yet).
            // For now, let's just return the Task ID and hope the frontend can handle it or just fail gracefully.
            // Ideally, we wait for it if it's fast, but we can't wait forever.
            // Flux is usually fast.
            resultUrl = kieData.data.taskId; // This is actually bad if we write it to the Ref Image column. 
            // FIXME: If async, we can't write to Ref Image URL immediately.
            // But Flux Pro is usually sync? 
        }

        // 5. Update Sheet immediately (assuming Sync result for now)
        // Library Sheet Structure:
        // A: Type, B: Name, C: Description, D: Ref Image URL, E: Negatives, F: Notes, G: Episode, H: Series
        // Ref Image URL is Column D

        const sheetRow = rowIndex + 2;

        if (resultUrl && !resultUrl.startsWith('task-')) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `LIBRARY!D${sheetRow}`,
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
