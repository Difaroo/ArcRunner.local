import fs from 'fs';
import path from 'path';
import { generateThumbnail } from './thumbnail-generator';

const MEDIA_DIR = path.join(process.cwd(), 'public', 'media', 'library');

// Ensure directory exists
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

export async function persistLibraryImage(remoteUrl: string, itemId: string, customFilename?: string): Promise<{ localPath: string, thumbnailPath: string | null }> {
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

        let filename = `${itemId}_${Date.now()}.${ext}`;

        if (customFilename) {
            // Defensive: Sanitize custom filename
            const sanitized = customFilename.replace(/[^a-zA-Z0-9\.\-\_\s]/g, '').trim();
            if (sanitized) {
                // Ensure extension is appended if not present
                filename = sanitized.endsWith(`.${ext}`) ? sanitized : `${sanitized}.${ext}`;
            }
        }

        // Defensive: Check for collision and auto-increment version
        let finalFilename = filename;
        let localFilePath = path.join(MEDIA_DIR, finalFilename);

        if (fs.existsSync(localFilePath)) {
            console.warn(`[Persistence] Collision detected for ${finalFilename}. Attempting to resolve...`);

            const parsed = path.parse(filename);
            const nameWithoutExt = parsed.name; // "Series.1 Asset 2"

            // Regex to find trailing " <Number>"
            // Matches "Text 2", "Text 99"
            const versionMatch = nameWithoutExt.match(/^(.*?)(\d+)$/);

            let baseName = nameWithoutExt;
            let currentVer = 0;

            if (versionMatch) {
                baseName = versionMatch[1]; // "Series.1 Asset " (includes trailing space)
                currentVer = parseInt(versionMatch[2], 10);
            }

            let conflict = true;
            let safety = 0;
            while (conflict && safety < 100) {
                currentVer++;
                // If baseName has simple separator, keep it clean
                // If original was "Asset 2", base is "Asset ". New is "Asset 3".
                // If original was "Asset", no match, base is "Asset". New is "Asset_1"? Or "Asset 1"?

                if (versionMatch) {
                    finalFilename = `${baseName}${currentVer}${parsed.ext}`;
                } else {
                    // Fallback for non-versioned names: append _1, _2
                    finalFilename = `${nameWithoutExt}_${currentVer}${parsed.ext}`;
                }

                localFilePath = path.join(MEDIA_DIR, finalFilename);
                conflict = fs.existsSync(localFilePath);
                safety++;
            }

            if (conflict) {
                // Nuclear fallback if 100 versions exist
                finalFilename = `${parsed.name}_${Date.now()}${parsed.ext}`;
                localFilePath = path.join(MEDIA_DIR, finalFilename);
            }

            console.log(`[Persistence] Resolved collision to: ${finalFilename}`);
        }

        // Write Full Res
        await fs.promises.writeFile(localFilePath, Buffer.from(buffer));
        const publicPath = `/media/library/${finalFilename}`;

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
