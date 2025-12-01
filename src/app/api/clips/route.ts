import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export interface Clip {
    id: string;
    scene: string;
    title: string;
    character: string;
    location: string;
    style: string;
    camera: string;
    action: string;
    dialog: string;
    refImageUrls: string;
    status: string;
    resultUrl?: string;
    episode?: string;
}

export async function GET() {
    try {
        console.log('API /api/clips called');
        // Fetch data from 'CLIPS', 'LIBRARY', and 'EPISODES' sheets
        const [clipsRows, libraryRows, episodesRows] = await Promise.all([
            getSheetData('CLIPS!A2:Z'),
            getSheetData('LIBRARY!A2:G'),
            getSheetData('EPISODES!A2:C')
        ]);

        console.log('Clips fetched:', clipsRows ? clipsRows.length : 'null');
        console.log('Library fetched:', libraryRows ? libraryRows.length : 'null');
        console.log('Episodes fetched:', episodesRows ? episodesRows.length : 'null');

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

        // Build Episode Map: Number -> Title
        const episodeTitles: Record<string, string> = {};
        if (episodesRows) {
            episodesRows.forEach(row => {
                // Column A: Series (Index 0) - Ignored for now
                const epNum = row[1]; // Column B: Episode Number
                const title = row[2]; // Column C: Title
                if (epNum && title) {
                    episodeTitles[epNum] = title;
                }
            });
        }

        // Infer Episodes from Clips (if not in EPISODES sheet)
        if (clipsRows) {
            clipsRows.forEach(row => {
                const epNum = row[25] || '1'; // Column Z: Episode
                if (!episodeTitles[epNum]) {
                    episodeTitles[epNum] = `Episode ${epNum}`;
                }
            });
        }

        // Map rows to Clip objects
        const clips = clipsRows
            .filter((row) => row[0] !== 'Scene #' && row[0]) // Filter out header row AND empty scene numbers
            .map((row, index) => {
                const character = row[3] || '';
                const location = row[5] || '';
                const style = row[6] || '';
                const camera = row[7] || '';

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
                    status: row[1] || '', // Column B
                    title: row[2] || '',         // Column C (Title)
                    character: row[3] || '',     // Column D
                    location: row[5] || '',      // Column F
                    style: style,                // Column G
                    camera: camera,              // Column H
                    action: row[8] || '',        // Column I
                    dialog: row[9] || '',        // Column J
                    refImageUrls: processedRefs, // Column K + Library
                    // Validate Result URL (Column T - Index 19)
                    resultUrl: (row[19] && (row[19].startsWith('http') || row[19].length < 100))
                        ? convertDriveUrl(row[19])
                        : '',
                    episode: row[25] || '1', // Column Z (Index 25) - Default to '1'
                };
            });

        // Build Library List for Frontend
        const libraryItems = libraryRows ? libraryRows.map(row => ({
            type: row[0],
            name: row[1],
            description: row[2],
            refImageUrl: convertDriveUrl(row[3]),
            negatives: row[4],
            notes: row[5],
            episode: row[6] || '1' // Column G: Episode (Default to '1')
        })).filter(item => item.name && item.name !== 'Name' && item.type !== 'Type') : [];

        return NextResponse.json({ clips, episodeTitles, libraryItems });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
