import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/sheets';
import { convertDriveUrl } from '@/lib/drive';
import { buildPrompt } from '@/lib/promptBuilder';
import { getLibraryItems } from '@/lib/library';
import { createFluxTask, FluxPayload, uploadFileBase64 } from '@/lib/kie';
import { getFilePath, getFileContent } from '@/lib/storage';
import mime from 'mime';

// Helper to detect MIME from Buffer (Magic Bytes)
function detectMimeFromBuffer(buffer: Buffer): string {
    if (buffer.length < 4) return 'application/octet-stream';

    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';

    // WEBP: RIFF....WEBP (Offset 8)
    if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp';

    return 'application/octet-stream';
}

async function processRefUrls(urls: string[]): Promise<string[]> {
    const processed: string[] = [];
    for (const url of urls) {
        // Check if local media URL
        if (url.includes('/api/media/')) {
            try {
                const parts = url.split('/api/media/')[1].split('/');
                const filePath = await getFilePath(parts);

                if (filePath) {
                    const buffer = await getFileContent(filePath);

                    // Detect MIME
                    let mimeType = detectMimeFromBuffer(buffer);
                    if (mimeType === 'application/octet-stream') mimeType = 'image/jpeg';

                    console.log(`Debug Processing: File=${parts.join('/')}, Detected Mime=${mimeType}`);

                    const base64Str = buffer.toString('base64');
                    const dataUri = `data:${mimeType};base64,${base64Str}`;

                    // UPLOAD TO KIE TEMP STORAGE
                    console.log(`Uploading local file to Kie Temp Storage...`);
                    const uploadRes = await uploadFileBase64(dataUri, parts[parts.length - 1]);

                    if (uploadRes.data && uploadRes.data.url) {
                        console.log(`Upload successful: ${uploadRes.data.url}`);
                        processed.push(uploadRes.data.url);
                    } else {
                        throw new Error(`Upload failed, no URL returned: ${JSON.stringify(uploadRes)}`);
                    }

                } else {
                    console.warn(`Local file not found: ${url}`);
                }
            } catch (e) {
                console.error(`Failed to process local url ${url}:`, e);
            }
        } else {
            // Remote URL (Drive, etc.) -> Fetch -> Base64 -> Upload -> Public URL
            try {
                console.log(`Fetching remote URL: ${url}`);
                const res = await fetch(url);
                if (!res.ok) {
                    console.warn(`Failed to fetch remote image: ${url} (${res.status})`);
                    continue;
                }

                const arrayBuffer = await res.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                // Detect MIME
                let mimeType = detectMimeFromBuffer(buffer);
                if (mimeType === 'application/octet-stream') mimeType = 'image/jpeg';

                const base64Str = buffer.toString('base64');
                const dataUri = `data:${mimeType};base64,${base64Str}`;

                // UPLOAD TO KIE TEMP STORAGE
                console.log(`Uploading remote content to Kie Temp Storage...`);
                // Use a default name for remote files if unknown
                const uploadRes = await uploadFileBase64(dataUri, 'remote_ref.jpg');

                if (uploadRes.data && uploadRes.data.url) {
                    console.log(`Upload successful: ${uploadRes.data.url}`);
                    processed.push(uploadRes.data.url);
                } else {
                    throw new Error(`Upload failed, no URL returned: ${JSON.stringify(uploadRes)}`);
                }

            } catch (e) {
                console.error(`Error processing remote url ${url}:`, e);
            }
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
            input.input_urls = imageUrls; // Reverted to input_urls as array
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
