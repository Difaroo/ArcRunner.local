import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/sheets';
import { convertDriveUrl } from '@/lib/drive';
import { buildPrompt } from '@/lib/promptBuilder';
import { getLibraryItems } from '@/lib/library';
import { createFluxTask, FluxPayload } from '@/lib/kie';
import { getFilePath, getFileContent } from '@/lib/storage';
import mime from 'mime';

async function processRefUrls(urls: string[]): Promise<string[]> {
    const processed: string[] = [];
    for (const url of urls) {
        // Check if local media URL
        if (url.includes('/api/media/')) {
            try {
                // Extract path parts: /api/media/upload/filename.jpg -> ['upload', 'filename.jpg']
                // Use a safer split around the known api route
                const parts = url.split('/api/media/')[1].split('/');
                const filePath = await getFilePath(parts);

                if (filePath) {
                    const buffer = await getFileContent(filePath);
                    // Determine mime type
                    const ext = filePath.split('.').pop()?.toLowerCase();
                    const mimeType = mime.getType(ext || '') || 'application/octet-stream';

                    const base64 = buffer.toString('base64');
                    processed.push(`data:${mimeType};base64,${base64}`);
                    console.log(`Converted local file ${parts.join('/')} to Base64`);
                } else {
                    console.warn(`Local file not found: ${url}`);
                }
            } catch (e) {
                console.error(`Failed to process local url ${url}:`, e);
            }
        } else {
            // Keep remote/drive URLs
            processed.push(url);
        }
    }
    return processed;
}

export async function POST(req: Request) {
    try {
        const { clip, rowIndex, model: requestedModel, aspectRatio: requestedRatio } = await req.json();

        if (!clip || typeof rowIndex !== 'number') {
            return NextResponse.json({ error: 'Missing clip or rowIndex' }, { status: 400 });
        }

        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // 1. Fetch Library Data
        const scopedLibraryItems = await getLibraryItems(clip.series);

        // 2. Build Prompt
        const prompt = buildPrompt(clip, scopedLibraryItems);
        console.log('Generated Flux Prompt:', prompt);

        // 2a. Gather Reference Images
        let imageUrls: string[] = [];

        // A. From Characters (Library Lookup)
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

        // B. From Location (Library Lookup)
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

        // C. From Clip Ref URL (Direct or Local)
        if (clip.refImageUrls) {
            const urls = clip.refImageUrls.split(',').map((s: string) => s.trim());
            urls.forEach((u: string) => {
                const converted = convertDriveUrl(u); // Keeps local URLs intact, converts Drive
                if (converted) imageUrls.push(converted);
            });
        }

        // Limit images
        imageUrls = imageUrls.slice(0, 1);

        // CRITICAL: Process URLs (Convert Local to Base64)
        imageUrls = await processRefUrls(imageUrls);

        // 3. Prepare Payload
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
            throw new Error('No Task ID returned from Jobs API');
        }

        // 6. Update Sheet
        const sheetRow = rowIndex + 2;

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

        await Promise.all(updates);

        return NextResponse.json({ success: true, data: kieData, resultUrl });

    } catch (error: any) {
        console.error('Flux Generate Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
