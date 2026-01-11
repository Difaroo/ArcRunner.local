/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { generateThumbnail } from './thumbnail-generator';

const MEDIA_DIR = path.join(process.cwd(), 'public', 'media', 'library');
const CLIPS_DIR = path.join(process.cwd(), 'public', 'media', 'clips');

// Ensure directories exist
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}
if (!fs.existsSync(CLIPS_DIR)) {
    fs.mkdirSync(CLIPS_DIR, { recursive: true });
}

export async function persistLibraryImage(remoteUrl: string, itemId: string, customFilename?: string): Promise<{ localPath: string, thumbnailPath: string | null }> {
    return persistMedia(remoteUrl, itemId, MEDIA_DIR, '/media/library', customFilename);
}

export async function persistClipMedia(remoteUrl: string, clipId: string, customFilename?: string): Promise<{ localPath: string, thumbnailPath: string | null }> {
    return persistMedia(remoteUrl, clipId, CLIPS_DIR, '/media/clips', customFilename);
}

// Refactored shared logic
async function persistMedia(remoteUrl: string, id: string, targetDir: string, publicPrefix: string, customFilename?: string): Promise<{ localPath: string, thumbnailPath: string | null }> {
    try {
        console.log(`[Persistence] Downloading media for ${id} from ${remoteUrl}`);

        const response = await fetch(remoteUrl);
        if (!response.ok) throw new Error(`Failed to fetch media: ${response.statusText}`);

        const buffer = await response.arrayBuffer();

        // Determine extension
        let ext = 'png';
        const contentType = response.headers.get('content-type');
        if (contentType) {
            if (contentType.includes('jpeg')) ext = 'jpg';
            else if (contentType.includes('webp')) ext = 'webp';
            else if (contentType.includes('video/mp4')) ext = 'mp4';
            else if (contentType.includes('video/quicktime')) ext = 'mov';
            else if (contentType.includes('video/webm')) ext = 'webm';
        } else {
            // Try URL extension
            const urlExt = remoteUrl.split('.').pop()?.split('?')[0];
            if (urlExt && ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'mov'].includes(urlExt)) {
                ext = urlExt;
            }
        }

        let filename = `${id}_${Date.now()}.${ext}`;

        if (customFilename) {
            const sanitized = customFilename.replace(/[^a-zA-Z0-9\.\-\_\s]/g, '').trim();
            if (sanitized) {
                filename = sanitized.endsWith(`.${ext}`) ? sanitized : `${sanitized}.${ext}`;
            }
        }

        // Defensive: Check for collision and auto-increment version
        let finalFilename = filename;
        let localFilePath = path.join(targetDir, finalFilename);

        if (fs.existsSync(localFilePath)) {
            // Simple collision strategy: Append timestamp if collision on ID-based name
            if (!customFilename) {
                finalFilename = `${id}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
                localFilePath = path.join(targetDir, finalFilename);
            } else {
                // Versioning logic for custom names (simplified)
                const parsed = path.parse(filename);
                let ver = 1;
                while (fs.existsSync(path.join(targetDir, finalFilename)) && ver < 20) {
                    finalFilename = `${parsed.name}_${ver}${parsed.ext}`;
                    ver++;
                }
                localFilePath = path.join(targetDir, finalFilename);
            }
        }

        await fs.promises.writeFile(localFilePath, Buffer.from(buffer));
        const publicPath = `${publicPrefix}/${finalFilename}`;

        console.log(`[Persistence] Saved to: ${localFilePath}`);

        // Generate Thumbnail (Handles both Image and Video)
        const thumbnailPath = await generateThumbnail(localFilePath, id);

        return { localPath: publicPath, thumbnailPath };

    } catch (error) {
        console.error(`[Persistence] Failed to persist media for ${id}:`, error);
        throw error;
    }
}
