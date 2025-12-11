import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/sheets';
import { convertDriveUrl } from '@/lib/drive';
import { buildPrompt } from '@/lib/promptBuilder';
import { getLibraryItems } from '@/lib/library';
import { createFluxTask, FluxPayload } from '@/lib/kie';

export async function POST(req: Request) {
    try {
        const { clip, rowIndex, model: requestedModel, aspectRatio: requestedRatio } = await req.json();

        if (!clip || typeof rowIndex !== 'number') {
            return NextResponse.json({ error: 'Missing clip or rowIndex' }, { status: 400 });
        }

        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // 1. Fetch Library Data (for prompt building)
        // 1. Fetch Library Data (for prompt building)
        // Using shared utility which handles headers dynamically and converts URLs
        const scopedLibraryItems = await getLibraryItems(clip.series);

        // 2. Build Prompt
        const prompt = buildPrompt(clip, scopedLibraryItems);
        console.log('Generated Flux Prompt:', prompt);

        // 2a. Gather Reference Images (Smart Switching)
        let imageUrls: string[] = [];

        // A. From Characters (Library Lookup)
        if (clip.character) {
            const charNames = clip.character.split(',').map((s: string) => s.trim());

            // Loop through names and find ref images in scroped library items
            charNames.forEach((name: string) => {
                // Find loose match
                const libItem = scopedLibraryItems.find((item: any) =>
                    item.name.toLowerCase() === name.toLowerCase()
                );

                if (libItem && libItem.refImageUrl) {
                    const converted = convertDriveUrl(libItem.refImageUrl);
                    if (converted) imageUrls.push(converted);
                }
            });
        }

        // B. From Location (Library Lookup)
        if (clip.location) {
            const locName = clip.location.trim();
            const libItem = scopedLibraryItems.find((item: any) =>
                item.name.toLowerCase() === locName.toLowerCase() && item.type === 'LIB_LOCATION'
            );

            if (libItem && libItem.refImageUrl) {
                const converted = convertDriveUrl(libItem.refImageUrl);
                if (converted) imageUrls.push(converted);
            }
        }

        // B. From Clip Ref URL (Direct in Sheet)
        if (clip.refImageUrls) {
            const urls = clip.refImageUrls.split(',').map((s: string) => s.trim());
            urls.forEach((u: string) => {
                const converted = convertDriveUrl(u);
                if (converted) imageUrls.push(converted);
            });
        }

        // Limit images
        imageUrls = imageUrls.slice(0, 1); // Flux usually focuses on one main input. 

        // 3. Prepare Payload for v1/jobs API (Flux)
        let model = 'flux-2/flex-text-to-image';
        const aspectRatio = requestedRatio || '16:9';

        const input: any = {
            prompt: prompt,
            aspect_ratio: aspectRatio,
            resolution: '2K'
        };

        if (imageUrls.length > 0) {
            console.log('Switching to Image-to-Image mode for Flux');
            model = 'flux-2/pro-image-to-image';
            input.input_urls = imageUrls;
            input.strength = 0.75; // Default strength
        }

        const payload: FluxPayload = {
            model: model,
            input: input
        };

        console.log('Flux Jobs Payload:', JSON.stringify(payload, null, 2));

        // 4. Call Kie.ai Jobs API
        const kieResponse = await createFluxTask(payload);
        const kieData = kieResponse; // Response wrapper for debugging if needed, but kieResponse.data contains task
        // Note: kieFetch returns the whole response body, createFluxTask types the generic T
        // Actually kieFetch: return data (json body). 
        // createFluxTask returns Promise<KieResponse<{taskId: string}>>

        console.log('Kie.ai Jobs Response:', JSON.stringify(kieResponse, null, 2));

        // 5. Handle Response
        let resultUrl = '';
        let status = 'Generating';

        if (kieResponse.data && kieResponse.data.taskId) {
            const taskId = kieResponse.data.taskId;
            resultUrl = `TASK:${taskId}`;
            status = 'Generating';
        } else {
            throw new Error('No Task ID returned from Jobs API');
        }

        // 6. Update Sheet
        const sheetRow = rowIndex + 2;

        const updates = [
            sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `CLIPS!D${sheetRow}`, // Status (Col D)
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[status]] }
            }),
            sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `CLIPS!V${sheetRow}`, // Result URL (Col V)
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[resultUrl]] }
            })
        ];

        await Promise.all(updates);

        return NextResponse.json({ success: true, data: kieData, resultUrl });

    } catch (error: any) {
        console.error('Flux Generate Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
