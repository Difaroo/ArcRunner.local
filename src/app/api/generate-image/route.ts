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
        // Map UI selection to Kie Model ID
        let model = 'flux-1.1-pro'; // Default (Pro)
        if (requestedModel === 'flux-flex') {
            model = 'flux-schnell';
        }

        const aspectRatio = requestedRatio || '16:9';

        const input: any = {
            prompt: prompt,
            aspect_ratio: aspectRatio,
            // resolution: '2K' // Not always supported by Schnell? Remove to be safe or keep if Pro
        };

        // Flux 1.1 Pro supports 'safety_tolerance' etc.
        if (model === 'flux-1.1-pro') {
            input.safety_tolerance = 2; // Allow some edge
        }

        if (imageUrls.length > 0) {
            console.log('Switching to Image-to-Image mode for Flux');
            // Kie specific: model name might change for Img2Img? 
            // Usually Flux handles it via input params. 
            // But previous code used 'flux-2/pro-image-to-image'.
            // Let's stick to the standard 'flux-1.1-pro' if it supports input_image, 
            // OR use the specific endpoint if Kie requires it.
            // Safe bet: keep `model` as is but add `image_url` param (singular?).
            // Kie typically uses `input_image` or `result_image`.
            // Previous code used `input_urls` (array).

            // Reverting to the logic found in previous code which seemed intentional for Kie:
            model = 'flux-2/pro-image-to-image'; // Forced for Ref2Img for now until confirmed otherwise
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
