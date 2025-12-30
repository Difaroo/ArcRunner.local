import fs from 'fs';
import path from 'path';
import { generateThumbnail } from './thumbnail-generator';

const MEDIA_DIR = path.join(process.cwd(), 'public', 'media', 'library');

// Ensure directory exists
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

export async function persistLibraryImage(remoteUrl: string, itemId: string): Promise<{ localPath: string, thumbnailPath: string | null }> {
    try {
        console.log(`[Persistence] Downloading image for Item ${itemId} from ${remoteUrl}`);

        const response = await fetch(remoteUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

        const buffer = await response.arrayBuffer();

        // Determine extension (default png)
        let ext = 'png';
        const contentType = response.headers.get('content-type');
        if (contentType) {
            if (contentType.includes('jpeg')) ext = 'jpg';
            else if (contentType.includes('webp')) ext = 'webp';
        }

        const filename = `${itemId}_${Date.now()}.${ext}`;
        const localFilePath = path.join(MEDIA_DIR, filename);

        // Write Full Res
        await fs.promises.writeFile(localFilePath, Buffer.from(buffer));
        const publicPath = `/media/library/${filename}`;

        console.log(`[Persistence] Saved full-res to: ${localFilePath}`);

        // Generate Thumbnail from Local File (More efficient than re-downloading)
        // Note: generateThumbnail expects a URL/Path. We can pass the absolute path.
        const thumbnailPath = await generateThumbnail(localFilePath, itemId);

        return { localPath: publicPath, thumbnailPath };

    } catch (error) {
        console.error(`[Persistence] Failed to persist image for Item ${itemId}:`, error);
        // Fallback: return remote url and null thumbnail? 
        // Or throw? If persistence fails, we should stick to remote URL to at least show something.
        throw error;
    }
}
