import { db } from '@/lib/db';
import { convertDriveUrl } from '@/lib/utils';
import { getLibraryItems, LibraryItem } from '@/lib/library';
import { processRefUrls } from '@/lib/image-processing';

export const AppService = {

    /**
     * Resolves and uploads reference images for a Clip.
     * Sources: Character (Library), Location (Library), Direct URL.
     * Returns: Array of Public Kie URLs.
     */
    async resolveReferenceImages(clip: any, limit: number = 3): Promise<string[]> {
        // ... (Keep existing logic, it calls getLibraryItems which is now DB based) ...
        const libraryItems = await getLibraryItems(clip.series);
        let rawImageUrls: string[] = [];

        // Helper to find library item image
        const findLibImage = (name: string, type: string) => {
            const item = libraryItems.find(i =>
                i.name && i.name.toLowerCase() === name.trim().toLowerCase() &&
                (!type || i.type === type)
            );
            if (item && item.refImageUrl) {
                // Handle multiple comma-separated URLs in one cell
                const urls = item.refImageUrl.split(',');
                urls.forEach(u => {
                    const converted = convertDriveUrl(u.trim());
                    if (converted) rawImageUrls.push(converted);
                });
            }
        };

        // A. Characters
        if (clip.character) {
            const names = clip.character.split(',');
            names.forEach((n: string) => findLibImage(n, 'LIB_CHARACTER'));
        }

        // B. Location
        if (clip.location) {
            findLibImage(clip.location, 'LIB_LOCATION');
        }

        // C. Direct Clip Refs
        if (clip.refImageUrls) {
            const urls = clip.refImageUrls.split(',');
            urls.forEach((u: string) => {
                const converted = convertDriveUrl(u.trim());
                if (converted) rawImageUrls.push(converted);
            });
        }

        // Deduplicate
        rawImageUrls = Array.from(new Set(rawImageUrls));

        // Limit
        rawImageUrls = rawImageUrls.slice(0, limit);

        // Upload/Process
        if (rawImageUrls.length > 0) {
            console.log(`Processing ${rawImageUrls.length} Reference Images...`);
            return await processRefUrls(rawImageUrls);
        }

        return [];
    },

    /**
     * Updates the status and result of a Clip in the DB.
     */
    async updateClipRow(rowIndex: number, updates: { status?: string, resultUrl?: string, model?: string }) {
        try {
            await db.clip.update({
                where: { id: rowIndex },
                data: updates
            });
        } catch (error) {
            console.error(`AppService: Failed to update clip ${rowIndex}`, error);
            throw error;
        }
    },

    /**
     * Updates just the Status to "Generating" (Fast Feedback)
     */
    async setGeneratingStatus(rowIndex: number) {
        return this.updateClipRow(rowIndex, { status: 'Generating' });
    },

    /**
     * Updates Status to Error
     */
    async setErrorStatus(rowIndex: number, errorMsg: string) {
        // We might want to log the error somewhere, or just set status "Error"
        console.error(`Row ${rowIndex} Error:`, errorMsg);
        return this.updateClipRow(rowIndex, { status: 'Error' });
    }
};
