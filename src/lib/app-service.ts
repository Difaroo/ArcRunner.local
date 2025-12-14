import { getGoogleSheetsClient, getHeaders, indexToColumnLetter } from '@/lib/sheets';
import { convertDriveUrl } from '@/lib/drive';
import { getLibraryItems, LibraryItem } from '@/lib/library';
import { processRefUrls } from '@/lib/image-processing';

export const AppService = {

    /**
     * Resolves and uploads reference images for a Clip.
     * Sources: Character (Library), Location (Library), Direct URL.
     * Returns: Array of Public Kie URLs.
     */
    async resolveReferenceImages(clip: any, limit: number = 3): Promise<string[]> {
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
     * Updates the status and result of a Clip in the Sheet.
     */
    async updateClipRow(rowIndex: number, updates: { status?: string, resultUrl?: string, model?: string }) {
        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;
        const sheetRow = rowIndex + 2;
        const headers = await getHeaders('CLIPS');

        const batchUpdates: any[] = [];

        // Helper
        const addUpdate = (colName: string, value: string) => {
            const idx = headers.get(colName);
            if (idx !== undefined) {
                const colLetter = indexToColumnLetter(idx);
                batchUpdates.push(sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `CLIPS!${colLetter}${sheetRow}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [[value]] }
                }));
            }
        };

        if (updates.status) addUpdate('Status', updates.status);
        if (updates.resultUrl) addUpdate('Result URL', updates.resultUrl);
        if (updates.model) addUpdate('Model', updates.model);

        if (batchUpdates.length > 0) {
            await Promise.all(batchUpdates);
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
