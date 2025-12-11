import { NextResponse } from 'next/server';
import { buildPrompt } from '@/lib/promptBuilder';
import { convertDriveUrl } from '@/lib/drive';
import { getLibraryItems } from '@/lib/library';
import { getGoogleSheetsClient } from '@/lib/sheets';
import { createVeoTask, VeoPayload } from '@/lib/kie';

export async function POST(req: Request) {
    try {
        const { clip, rowIndex } = await req.json(); // rowIndex is 0-based index in the array

        if (!clip || typeof rowIndex !== 'number') {
            return NextResponse.json({ error: 'Missing clip or rowIndex' }, { status: 400 });
        }

        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // 1. Fetch Library Data
        // Using shared library which correctly handles header mapping and series filtering
        // We fetch for this clip's series (if available in clip, otherwise fetch all and filtering happens in param?)
        // The clip object from api/clips usually has 'series' property.
        // Assuming clip.series exists. If not, we fetch all.
        const libraryItems = await getLibraryItems(clip.series);

        // 2. Build Prompt
        const prompt = buildPrompt(clip, libraryItems);
        console.log('Generated Prompt:', prompt);

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

        // B. From Location (Library Lookup)
        if (clip.location) {
            const locName = clip.location.trim();
            const item = libraryItems.find(i => i.name && i.name.toLowerCase() === locName.toLowerCase() && i.type === 'LIB_LOCATION');
            if (item && item.refImageUrl) {
                imageUrls.push(convertDriveUrl(item.refImageUrl));
            }
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
        const payload: VeoPayload = {
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
        const kieResponse = await createVeoTask(payload);

        console.log('Kie.ai Success Response:', JSON.stringify(kieResponse, null, 2));

        const taskId = kieResponse.data?.taskId; // Correct path based on user screenshot

        // 4. Update Sheet with Task ID and Status
        // Status is Col B (Index 1), Log is Col T (Index 19) or Result URL (Index 18)
        // We'll put Task ID in Result URL for now to track it.

        // Row number in sheet = rowIndex + 2 (Header is 1, 0-based index)
        const sheetRow = rowIndex + 2;

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `CLIPS!D${sheetRow}`, // Status Column
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Generating']] }
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `CLIPS!V${sheetRow}`, // Result URL Column (storing ID temporarily)
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[`TASK:${taskId}` || 'ID_MISSING']] }
        });

        return NextResponse.json({ success: true, taskId, kieData: kieResponse }); // Send back full data for debugging

    } catch (error: any) {
        console.error('Generate error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
