import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, getHeaders, indexToColumnLetter } from '@/lib/sheets';
import { convertDriveUrl } from '@/lib/drive';
import { buildPrompt } from '@/lib/promptBuilder';
import { getLibraryItems } from '@/lib/library';
import { createFluxTask, FluxPayload, uploadFileBase64 } from '@/lib/kie';
import { getFilePath, getFileContent } from '@/lib/storage';
import mime from 'mime';

import { processRefUrls } from '@/lib/image-processing';

// ... (Imports)

// (Removed duplicated fragment)

export async function POST(req: Request) {
    let sheets: any;
    let spreadsheetId: string | undefined;
    let sheetRow: number | undefined;

    try {
        const { clip, rowIndex, model: requestedModel, aspectRatio: requestedRatio } = await req.json();

        if (!clip || typeof rowIndex !== 'number') {
            return NextResponse.json({ error: 'Missing clip or rowIndex' }, { status: 400 });
        }

        sheets = await getGoogleSheetsClient();
        spreadsheetId = process.env.SPREADSHEET_ID;
        sheetRow = rowIndex + 2;

        // 1. Fetch Library Data
        const scopedLibraryItems = await getLibraryItems(clip.series);

        // 2. Build Prompt
        const prompt = buildPrompt(clip, scopedLibraryItems);
        console.log('Generated Flux Prompt:', prompt);

        // 2a. Gather Reference Images
        let imageUrls: string[] = [];

        // A. From Characters
        if (clip.character) {
            const charNames = clip.character.split(',').map((s: string) => s.trim());
            charNames.forEach((name: string) => {
                const libItem = scopedLibraryItems.find((item: any) =>
                    item.name.toLowerCase() === name.toLowerCase()
                );
                if (libItem && libItem.refImageUrl) {
                    const refs = libItem.refImageUrl.split(',').map((u: string) => u.trim());
                    refs.forEach((ref: string) => {
                        const converted = convertDriveUrl(ref);
                        if (converted) imageUrls.push(converted);
                    });
                }
            });
        }

        // B. From Location
        if (clip.location) {
            const locNames = clip.location.split(',').map((s: string) => s.trim());
            locNames.forEach((name: string) => {
                const libItem = scopedLibraryItems.find((item: any) =>
                    item.name.toLowerCase() === name.toLowerCase() && item.type === 'LIB_LOCATION'
                );
                if (libItem && libItem.refImageUrl) {
                    const refs = libItem.refImageUrl.split(',').map((u: string) => u.trim());
                    refs.forEach((ref: string) => {
                        const converted = convertDriveUrl(ref);
                        if (converted) imageUrls.push(converted);
                    });
                }
            });
        }

        // C. From Clip Ref URL
        if (clip.refImageUrls) {
            const urls = clip.refImageUrls.split(',').map((s: string) => s.trim());
            urls.forEach((u: string) => {
                const converted = convertDriveUrl(u);
                if (converted) imageUrls.push(converted);
            });
        }

        // Limit images
        imageUrls = imageUrls.slice(0, 1);

        // CRITICAL: Process URLs (Convert Local to Base64)
        imageUrls = await processRefUrls(imageUrls);

        // 3. Prepare Payload
        // Reverting to legacy Model IDs validated by Probe 9
        let model = 'flux-2/flex-text-to-image';
        // Note: Previous code defaulted to this. If we want Pro T2I, we can try 'flux-2/pro-text-to-image' later.

        const aspectRatio = requestedRatio || '16:9';

        const input: any = {
            prompt: prompt,
            aspect_ratio: aspectRatio,
            resolution: '2K' // Required by this endpoint (Must be Uppercase)
        };

        if (imageUrls.length > 0) {
            console.log('Switching to Image-to-Image mode for Flux');
            model = 'flux-2/pro-image-to-image';
            input.input_urls = imageUrls;
            input.strength = 0.75;
        }

        const payload: FluxPayload = {
            model: model,
            input: input
        };

        console.log('Flux Jobs Payload:', JSON.stringify(payload, null, 2));

        // 4. Call Kie.ai Jobs API
        const kieResponse = await createFluxTask(payload);
        const kieData = kieResponse;

        console.log('Kie.ai Jobs Response:', JSON.stringify(kieResponse, null, 2));

        // 5. Handle Response
        let resultUrl = '';
        let status = 'Generating';

        if (kieResponse.data && kieResponse.data.taskId) {
            const taskId = kieResponse.data.taskId;
            resultUrl = `TASK:${taskId}`;
            status = 'Generating';
        } else {
            // Dump response for debugging
            throw new Error(`No Task ID returned. Response: ${JSON.stringify(kieResponse)}`);
        }

        // 6. Update Sheet
        // sheetRow is already defined above

        const headers = await getHeaders('CLIPS');
        const modelColIdx = headers.get('Model');

        const updates = [
            sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `CLIPS!D${sheetRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[status]] }
            }),
            sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `CLIPS!V${sheetRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[resultUrl]] }
            })
        ];

        if (modelColIdx !== undefined) {
            const colLetter = indexToColumnLetter(modelColIdx);
            updates.push(sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `CLIPS!${colLetter}${sheetRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[requestedModel || 'flux-pro']] }
            }));
        }

        await Promise.all(updates);

        return NextResponse.json({ success: true, data: kieData, resultUrl });

    } catch (error: any) {
        console.error('Flux Generate Error:', error);

        // FAIL-SAFE: Update Sheet Status to Error to stop UI spinner
        if (sheets && spreadsheetId && sheetRow) {
            try {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `CLIPS!D${sheetRow}`, // Status Column
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [['Error']] }
                });
                console.log('Updated Flux sheet status to Error');
            } catch (sheetErr) {
                console.error('Failed to update sheet status to error:', sheetErr);
            }
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
