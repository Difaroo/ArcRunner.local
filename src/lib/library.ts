import { db } from './db';
// convertDriveUrl is likely not needed if URLs are already clean types, but safe to keep/use purely for string sanitization if desired?
// Actually in DB they are stored as strings. We don't need 'convertDriveUrl' helper blindly on stored data unless it's raw drive IDs.
// The migration script copied the raw strings from sheets. 
// So they might be raw drive URLs like "https://drive.google.com/open?id=..."
// We should run convertDriveUrl just in case.
import { convertDriveUrl } from '@/lib/utils';

export interface LibraryItem {
    id: string; // Row index or unique ID
    type: string;
    name: string;
    description: string;
    refImageUrl: string;
    thumbnailPath?: string;
    negatives: string;
    notes: string;
    episode: string;
    series: string;
    status?: string;
    taskId?: string;
}

/**
 * Fetches all items from the LIBRARY DB table.
 * Optionally filters by Series ID.
 * Returns valid LibraryItem objects.
 */
export async function getLibraryItems(filterSeriesId?: string): Promise<LibraryItem[]> {
    try {
        const query: any = {};
        if (filterSeriesId) {
            query.where = { seriesId: filterSeriesId }; // NOTE: Schema uses seriesId
        }

        const items = await db.studioItem.findMany(query);

        return items.map(item => ({
            id: item.id.toString(),
            type: item.type,
            name: item.name,
            description: item.description || '',
            refImageUrl: item.refImageUrl ? (convertDriveUrl(item.refImageUrl) || item.refImageUrl) : '',
            thumbnailPath: item.thumbnailPath || '',
            negatives: item.negatives || '',
            notes: item.notes || '',
            episode: item.episode || '1',
            series: item.seriesId,
            status: item.status || 'IDLE',
            taskId: item.taskId || ''
        }));
    } catch (error) {
        console.error('Error fetching library items (DB):', error);
        return [];
    }
}

