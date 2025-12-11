import { getSheetData, parseHeaders } from './sheets';
import { convertDriveUrl } from './drive';

export interface LibraryItem {
    id: string; // Row index or unique ID
    type: string;
    name: string;
    description: string;
    refImageUrl: string;
    negatives?: string;
    notes?: string;
    episode?: string;
    series?: string;
}

/**
 * Fetches all items from the LIBRARY sheet.
 * Optionally filters by Series ID.
 * Returns valid LibraryItem objects with converted Drive URLs.
 */
export async function getLibraryItems(filterSeriesId?: string): Promise<LibraryItem[]> {
    try {
        const rawData = await getSheetData('LIBRARY!A1:ZZ');
        if (!rawData || rawData.length === 0) return [];

        const headers = parseHeaders(rawData);
        const rows = rawData.slice(1);

        const getValue = (row: any[], colName: string): string => {
            const index = headers.get(colName);
            if (index === undefined) return '';
            return String(row[index] || '').trim();
        };

        const items: LibraryItem[] = rows.map((row, index) => {
            return {
                id: index.toString(),
                type: getValue(row, 'Type'),
                name: getValue(row, 'Name'),
                description: getValue(row, 'Description'),
                refImageUrl: convertDriveUrl(getValue(row, 'Ref Image URLs') || getValue(row, 'Ref Images') || getValue(row, 'Ref Image')),
                negatives: getValue(row, 'Negatives'),
                notes: getValue(row, 'Notes'),
                episode: getValue(row, 'Episode') || '1',
                series: getValue(row, 'Series') || '1' // Default to Series 1
            };
        }).filter(item => item.name); // Filter out empty rows

        if (filterSeriesId) {
            return items.filter(item => item.series === filterSeriesId);
        }

        return items;
    } catch (error) {
        console.error('Error fetching library items:', error);
        return [];
    }
}
