import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET() {
    try {
        console.log('API /api/clips called');
        // Fetch data from 'CLIPS' and 'LIBRARY' sheets
        const [clipsRows, libraryRows] = await Promise.all([
            getSheetData('CLIPS!A2:Z'),
            getSheetData('LIBRARY!A2:F')
        ]);

        console.log('Clips fetched:', clipsRows ? clipsRows.length : 'null');
        console.log('Library fetched:', libraryRows ? libraryRows.length : 'null');

        if (!clipsRows) {
            return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
        }

        // Helper: Convert Drive URL to Direct Link
        const convertDriveUrl = (url: string) => {
            if (!url) return '';
            const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                return `https://drive.google.com/uc?export=download&id=${match[1]}`;
            }
            return url;
        };

        // Build Library Map: Name -> Image URL
        const libraryImages: Record<string, string> = {};
        if (libraryRows) {
            libraryRows.forEach(row => {
                const name = row[1]; // Column B: Name
                const imageUrl = row[3]; // Column D: Ref Image URLs
                if (name && imageUrl) {
                    libraryImages[name.toLowerCase()] = convertDriveUrl(imageUrl.trim());
                }
            });
        }

        // Map rows to Clip objects
        const clips = clipsRows
            .filter((row) => row[0] !== 'Scene #') // Filter out header row
            .map((row, index) => {
                const character = row[3] || '';
                const location = row[5] || '';

                // 1. Get Clip-specific refs
                const rawRefs = row[10] || '';
                let refUrls = rawRefs.split(',').map((url: string) => convertDriveUrl(url.trim())).filter(Boolean);

                // 2. Look up Library refs (if not already present or to augment)
                // Note: User might want Library images to show up even if clip has refs, or only if missing.
                // Assuming we append Library images to the list.

                // Character Image
                if (character) {
                    const charNames = character.split(',').map((c: string) => c.trim().toLowerCase());
                    charNames.forEach((name: string) => {
                        if (libraryImages[name] && !refUrls.includes(libraryImages[name])) {
                            refUrls.push(libraryImages[name]);
                        }
                    });
                }

                // Location Image
                if (location && libraryImages[location.toLowerCase()] && !refUrls.includes(libraryImages[location.toLowerCase()])) {
                    refUrls.push(libraryImages[location.toLowerCase()]);
                }

                const processedRefs = refUrls.join(',');

                return {
                    id: index.toString(),
                    scene: row[0] || '',         // Column A (Scene #)
                    status: row[1] || 'Pending', // Column B
                    title: row[2] || '',         // Column C (Title)
                    character: row[3] || '',     // Column D
                    location: row[5] || '',      // Column F
                    style: row[6] || '',         // Column G
                    camera: row[7] || '',        // Column H
                    action: row[8] || '',        // Column I
                    dialog: row[9] || '',        // Column J
                    refImageUrls: processedRefs, // Column K + Library
                    // Validate Result URL (Column S)
                    // It might contain prompt text due to data corruption.
                    // Only accept if it starts with http or is a short Task ID.
                    resultUrl: (row[18] && (row[18].startsWith('http') || row[18].length < 100))
                        ? convertDriveUrl(row[18])
                        : '',
                };
            });

        return NextResponse.json({ clips });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
