import { NextResponse } from 'next/server';
import { buildPrompt } from '@/lib/promptBuilder';
import { convertDriveUrl } from '@/lib/drive';
import { getLibraryItems } from '@/lib/library';
import { getGoogleSheetsClient, getHeaders, indexToColumnLetter } from '@/lib/sheets';
import { createVeoTask, VeoPayload, uploadFileBase64 } from '@/lib/kie';
import { getFilePath, getFileContent } from '@/lib/storage';
import mime from 'mime';
import { processRefUrls } from '@/lib/image-processing';

export async function POST(req: Request) {
    // Shared setup for error handling
    let sheets: any;
    let spreadsheetId: string | undefined;
    let sheetRow: number | undefined;

    try {
        const { clip, rowIndex } = await req.json(); // rowIndex is 0-based index in the array

        if (!clip || typeof rowIndex !== 'number') {
            return NextResponse.json({ error: 'Missing clip or rowIndex' }, { status: 400 });
        }

        sheets = await getGoogleSheetsClient();
        spreadsheetId = process.env.SPREADSHEET_ID;
        sheetRow = rowIndex + 2;

        // 0. Update Status to "Generating" immediately to give feedback
        // This failsafe ensures that if the process hangs, at least the sheet knows it started.
        // It also overrides any "Error" state from previous runs immediately.
        if (sheets && spreadsheetId && sheetRow) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `CLIPS!D${sheetRow}`, // Status Column
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [['Generating']] }
            });
        }

        // 1. Fetch Library Data
        const libraryItems = await getLibraryItems(clip.series);

        // 2. Build Prompt
        const prompt = buildPrompt(clip, libraryItems);
        console.log('Generated Prompt:', prompt);

        // 3. Build Image Params (Ref2Vid)
        let rawImageUrls: string[] = [];

        // A. From Characters (Library Lookup)
        if (clip.character) {
            const charNames = clip.character.split(',').map((s: string) => s.trim());
            charNames.forEach((name: string) => {
                const item = libraryItems.find(i => i.name && i.name.toLowerCase() === name.toLowerCase() && i.type === 'LIB_CHARACTER');
                if (item && item.refImageUrl) {
                    rawImageUrls.push(convertDriveUrl(item.refImageUrl));
                }
            });
        }

        // B. From Location (Library Lookup)
        if (clip.location) {
            const locName = clip.location.trim();
            const item = libraryItems.find(i => i.name && i.name.toLowerCase() === locName.toLowerCase() && i.type === 'LIB_LOCATION');
            if (item && item.refImageUrl) {
                rawImageUrls.push(convertDriveUrl(item.refImageUrl));
            }
        }

        // C. From Clip (Direct URL)
        if (clip.refImageUrls) {
            const clipRefs = clip.refImageUrls.split(',').map((s: string) => s.trim());
            clipRefs.forEach((url: string) => {
                if (url) rawImageUrls.push(convertDriveUrl(url));
            });
        }

        // Limit to 3 images
        rawImageUrls = rawImageUrls.slice(0, 3);

        // ...


        // ...

        // Limit to 3 images
        rawImageUrls = rawImageUrls.slice(0, 3);

        // --- PROCESS IMAGES FOR KIE ---
        // Use Shared Utility
        const finalImageUrls = await processRefUrls(rawImageUrls);

        if (finalImageUrls.length > 0) {
            console.log('Images uploaded to Kie:', finalImageUrls);
        }

        // Determine model based on Request Param OR Quality column (default to veo3_fast)
        const { model: requestedModel, aspectRatio: requestedRatio } = await req.json().then(data => data).catch(() => ({}));

        let model = 'veo3_fast'; // Default
        let aspectRatio = requestedRatio || '16:9'; // Default to UI selection or 16:9

        // 1. Check Request Param (from UI Menu)
        if (requestedModel === 'veo-quality') {
            model = 'veo3';
        } else {
            // Default to fast if unspecified or unknown
            model = 'veo3_fast';
        }

        // Force veo3_fast and 16:9 if using images (Veo requirement)
        if (finalImageUrls.length > 0) {
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

        if (finalImageUrls.length > 0) {
            payload.imageUrls = finalImageUrls;
            payload.generationType = 'REFERENCE_2_VIDEO';
        }

        console.log('Final Payload:', JSON.stringify(payload, null, 2));

        // 4. Call Kie.ai API
        const kieResponse = await createVeoTask(payload);

        console.log('Kie.ai Success Response:', JSON.stringify(kieResponse, null, 2));

        const taskId = kieResponse.data?.taskId;

        // 4. Update Sheet with Task ID 
        // We leave Status as "Generating" (set at start) or could re-assert it.
        const headers = await getHeaders('CLIPS');
        const modelColIdx = headers.get('Model');

        const updates = [
            sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `CLIPS!V${sheetRow}`, // Result URL Column (storing ID temporarily)
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[`TASK:${taskId}` || 'ID_MISSING']] }
            })
        ];

        if (modelColIdx !== undefined) {
            const colLetter = indexToColumnLetter(modelColIdx);
            updates.push(sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `CLIPS!${colLetter}${sheetRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[requestedModel || 'veo-fast']] }
            }));
        }

        await Promise.all(updates);

        return NextResponse.json({ success: true, taskId, kieData: kieResponse });

    } catch (error: any) {
        console.error('Generate error:', error);

        // UPDATE SHEET STATUS TO ERROR
        // This prevents the 'spinning forever' UI bug
        if (sheets && spreadsheetId && sheetRow) {
            try {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `CLIPS!D${sheetRow}`, // Status Column
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [['Error']] }
                });
                console.log('Updated sheet status to Error');
            } catch (sheetErr) {
                console.error('Failed to update sheet status to error:', sheetErr);
            }
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
