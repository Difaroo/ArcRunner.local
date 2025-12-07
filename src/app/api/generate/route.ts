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
        const { clip, rowIndex } = await req.json(); // rowIndex is 0-based index in the array

        if (!clip || typeof rowIndex !== 'number') {
            return NextResponse.json({ error: 'Missing clip or rowIndex' }, { status: 400 });
        }

        const sheets = await getSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // 1. Fetch Library Data
        const libRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'LIBRARY!A2:F', // Assuming headers in row 1
        });

        const libraryRows = libRes.data.values || [];
        const libraryItems = libraryRows.map(row => ({
            type: row[0],
            name: row[1],
            description: row[2],
            refImageUrl: row[3] // Col D: Ref Image URLs
        }));

        // 2. Build Prompt
        const prompt = buildPrompt(clip, libraryItems);
        console.log('Generated Prompt:', prompt);

        // Helper: Convert Drive URL to Direct Link
        const convertDriveUrl = (url: string) => {
            if (!url) return '';
            // Handle standard Drive view links
            const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                return `https://drive.google.com/uc?export=download&id=${match[1]}`;
            }
            return url;
        };

        // 3. Build Image Params (Ref2Vid)
        let imageUrls: string[] = [];

        // A. From Characters (Library Lookup)
        if (clip.character) {
            const charNames = clip.character.split(',').map((s: string) => s.trim());
            charNames.forEach((name: string) => {
                const item = libraryItems.find(i => i.name && i.name.toLowerCase() === name.toLowerCase() && i.type === 'LIB_CHARACTER');
                if (item && item.refImageUrl) {
                    imageUrls.push(convertDriveUrl(item.refImageUrl));
                }
            });
        }

        // B. From Clip (Direct URL)
        if (clip.refImageUrls) {
            const clipRefs = clip.refImageUrls.split(',').map((s: string) => s.trim());
            clipRefs.forEach((url: string) => {
                if (url) imageUrls.push(convertDriveUrl(url));
            });
        }

        // Limit to 3 images
        imageUrls = imageUrls.slice(0, 3);

        // Determine model based on Request Param OR Quality column (default to veo3_fast)
        const { model: requestedModel, aspectRatio: requestedRatio } = await req.json().then(data => data).catch(() => ({}));

        let model = 'veo3_fast'; // Default
        let aspectRatio = requestedRatio || '16:9'; // Default to UI selection or 16:9

        // 1. Check Request Param (from UI Menu)
        if (requestedModel === 'veo-quality') {
            model = 'veo3';
        } else if (requestedModel === 'veo-fast') {
            model = 'veo3_fast';
        } else {
            // 2. Fallback to 'Quality' column if no param (legacy support)
            const quality = (clip['Quality'] || 'fast').toLowerCase();
            model = quality === 'quality' ? 'veo3' : 'veo3_fast';
        }

        // Force veo3_fast and 16:9 if using images (Veo requirement)
        if (imageUrls.length > 0) {
            console.log('Ref2Vid Active: Forcing veo3_fast and 16:9');
            model = 'veo3_fast';
            aspectRatio = '16:9'; // Veo Ref2Vid only supports 16:9
        }

        // Construct Payload (Matching Kie.ai Spec: camelCase)
        const payload: any = {
            prompt: prompt,
            model: model,
            aspectRatio: aspectRatio,
            enableFallback: true,
            enableTranslation: true,
        };

        if (imageUrls.length > 0) {
            payload.imageUrls = imageUrls;
            payload.generationType = 'REFERENCE_2_VIDEO';
        }

        console.log('Final Payload:', JSON.stringify(payload, null, 2));

        // 4. Call Kie.ai API
        const kieRes = await fetch('https://api.kie.ai/api/v1/veo/generate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const kieData = await kieRes.json();
        console.log('Kie.ai Success Response:', JSON.stringify(kieData, null, 2));

        if (!kieRes.ok) {
            console.error('Kie.ai Error Response:', JSON.stringify(kieData, null, 2));
            throw new Error(kieData.error?.message || JSON.stringify(kieData) || 'Failed to call Kie.ai');
        }

        const taskId = kieData.data?.taskId; // Correct path based on user screenshot

        // 4. Update Sheet with Task ID and Status
        // Status is Col B (Index 1), Log is Col T (Index 19) or Result URL (Index 18)
        // We'll put Task ID in Result URL for now to track it.

        // Row number in sheet = rowIndex + 2 (Header is 1, 0-based index)
        const sheetRow = rowIndex + 2;

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `CLIPS!B${sheetRow}`, // Status Column
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Generating']] }
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `CLIPS!S${sheetRow}`, // Result URL Column (storing ID temporarily)
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[taskId || 'ID_MISSING']] }
        });

        return NextResponse.json({ success: true, taskId, kieData }); // Send back full data for debugging

    } catch (error: any) {
        console.error('Generate error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
