import { getFilePath, getFileContent } from '@/lib/storage';
import { uploadFileBase64 } from '@/lib/kie';
import mime from 'mime';

/**
 * Detect MIME type from Buffer magic bytes
 */
export function detectMimeFromBuffer(buffer: Buffer): string {
    if (buffer.length < 4) return 'application/octet-stream';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
    if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp';
    return 'application/octet-stream';
}

/**
 * Processes a list of image URLs (Local or Remote) for Kie.ai consumption.
 * 1. Fetches content (from disk or web).
 * 2. Uploads to Kie.ai Temp Storage (Base64).
 * 3. Returns array of public Kie URLs.
 */
export async function processRefUrls(urls: string[]): Promise<string[]> {
    const processed: string[] = [];

    for (const url of urls) {
        try {
            let buffer: Buffer;
            let mimeType: string;
            let filename = 'image.jpg';

            // Check if Local URL (/api/media/...)
            if (url.includes('/api/media/')) {
                const cleanPath = url.split('/api/media/')[1];
                const segments = cleanPath.split('/');
                const filePath = await getFilePath(segments);

                if (!filePath) {
                    console.warn(`Local file not found: ${url}`);
                    continue;
                }

                buffer = await getFileContent(filePath);
                filename = segments[segments.length - 1];
                mimeType = detectMimeFromBuffer(buffer);
                if (mimeType === 'application/octet-stream') mimeType = mime.getType(filename) || 'image/jpeg';

            } else {
                // Remote URL
                console.log(`Fetching remote image: ${url}`);
                const res = await fetch(url);
                if (!res.ok) {
                    console.warn(`Failed to fetch remote image: ${url} (${res.statusText})`);
                    continue;
                }
                const arrayBuffer = await res.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
                const contentType = res.headers.get('content-type');
                mimeType = contentType || detectMimeFromBuffer(buffer);

                // Guess filename
                const ext = mime.getExtension(mimeType) || 'jpg';
                filename = `remote_ref.${ext}`;
            }

            // Convert to Data URI
            const base64Str = buffer.toString('base64');
            const dataUri = `data:${mimeType};base64,${base64Str}`;

            // Upload to Kie
            console.log(`Uploading ${filename} to Kie...`);
            const uploadRes: any = await uploadFileBase64(dataUri, filename);

            const kieUrl = uploadRes.data?.downloadUrl || uploadRes.url || uploadRes.data?.url;

            if (kieUrl) {
                console.log(`Upload successful: ${kieUrl}`);
                processed.push(kieUrl);
            } else {
                throw new Error(`Upload failed, no URL in response: ${JSON.stringify(uploadRes)}`);
            }

        } catch (e: any) {
            console.error(`Error processing image ${url}:`, e);
            // We continue processing other images even if one fails
        }
    }
    return processed;
}
