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
    seed?: string;
    episode?: string;
    series?: string;
    sortOrder?: number;
}

export interface Series {
    id: string;
    title: string;
    totalEpisodes: string;
    currentEpisodes: string;
    status: string;
}

export async function GET() {
    try {
        console.log('API /api/clips called');
        // Fetch data from 'CLIPS', 'LIBRARY', 'EPISODES', and 'SERIES' sheets
        // Fetching from A1 to get headers
        // Fetching sequentially to debug hang
        const clipsData = await getSheetData('CLIPS!A1:ZZ');
        const libraryData = await getSheetData('LIBRARY!A1:ZZ');
        const episodesData = await getSheetData('EPISODES!A1:ZZ');
        const seriesData = await getSheetData('SERIES!A1:ZZ');

        // Helper to parse sheet data (Headers + Rows)
        const parseSheet = (data: any[][] | null | undefined) => {
            if (!data || data.length === 0) return { headers: new Map<string, number>(), rows: [] };
            const headerRow = data[0];
            const headers = new Map<string, number>();
            headerRow.forEach((h, i) => headers.set(h.trim(), i));
            const rows = data.slice(1);
            return { headers, rows };
        };

        const clipsSheet = parseSheet(clipsData);
        const librarySheet = parseSheet(libraryData);
        const episodesSheet = parseSheet(episodesData);
        const seriesSheet = parseSheet(seriesData);

        console.log('Clips fetched:', clipsSheet.rows.length);
        console.log('Library fetched:', librarySheet.rows.length);
        console.log('Episodes fetched:', episodesSheet.rows.length);
        console.log('Series fetched:', seriesSheet.rows.length);

        // Helper to safely get value by header name
        const getValue = (row: any[], headerMap: Map<string, number>, colName: string): string => {
            const index = headerMap.get(colName);
            if (index === undefined) return '';
            return String(row[index] || '');
        };

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
        librarySheet.rows.forEach(row => {
            const name = getValue(row, librarySheet.headers, 'Name');
            const imageUrl = getValue(row, librarySheet.headers, 'Ref Image URLs');
            if (name && imageUrl) {
                libraryImages[name.toLowerCase()] = convertDriveUrl(imageUrl.trim());
            }
        });

        // Build Episode List (with Series ID)
        const episodes: { series: string, id: string, title: string }[] = [];
        const episodeTitles: Record<string, string> = {}; // Keep for backward compat / lookup

        episodesSheet.rows.forEach(row => {
            const seriesId = (getValue(row, episodesSheet.headers, 'Series') || '1').trim();
            // Allow 'Episode' or 'Episode Number'
            let epNum = getValue(row, episodesSheet.headers, 'Episode Number');
            if (!epNum) epNum = getValue(row, episodesSheet.headers, 'Episode');
            epNum = epNum.trim();

            const title = getValue(row, episodesSheet.headers, 'Title').trim();

            if (epNum && title) {
                episodes.push({ series: seriesId, id: epNum, title });
                episodeTitles[epNum] = title;
            }
        });

        // Infer Episodes from Clips (if not in EPISODES sheet)
        clipsSheet.rows.forEach(row => {
            const epNum = getValue(row, clipsSheet.headers, 'Episode') || '1';
            const seriesId = getValue(row, clipsSheet.headers, 'Series') || '1';

            // Check if already in list for this series
            const exists = episodes.find(e => e.id === epNum && e.series === seriesId);
            if (!exists) {
                const title = `Episode ${epNum}`;
                episodes.push({ series: seriesId, id: epNum, title });
                // Only add to titles map if not present (sheet titles take precedence)
                if (!episodeTitles[epNum]) {
                    episodeTitles[epNum] = title;
                }
            }
        });

        // Map rows to Clip objects
        const clips = clipsSheet.rows
            .map((row, index) => ({ row, index })) // Preserve original index (relative to data rows)
            .filter(({ row }) => {
                const scene = getValue(row, clipsSheet.headers, 'Scene #');
                return scene !== 'Scene #' && scene; // Filter out header row (if somehow duplicated) AND empty scene numbers
            })
            .map(({ row, index }) => {
                let character = getValue(row, clipsSheet.headers, 'Character');
                if (!character) character = getValue(row, clipsSheet.headers, 'Characters');
                const location = getValue(row, clipsSheet.headers, 'Location');

                // 1. Get Clip-specific refs
                const rawRefs = getValue(row, clipsSheet.headers, 'Ref Image URLs');
                const clipRefUrls = rawRefs.split(',').map((url: string) => convertDriveUrl(url.trim())).filter(Boolean);

                // 2. Look up Library refs
                const libraryRefUrls: string[] = [];

                // Character Image
                if (character) {
                    const charNames = character.split(',').map((c: string) => c.trim().toLowerCase());
                    charNames.forEach((name: string) => {
                        if (libraryImages[name] && !clipRefUrls.includes(libraryImages[name]) && !libraryRefUrls.includes(libraryImages[name])) {
                            libraryRefUrls.push(libraryImages[name]);
                        }
                    });
                }

                // Location Image
                if (location && libraryImages[location.toLowerCase()] && !clipRefUrls.includes(libraryImages[location.toLowerCase()]) && !libraryRefUrls.includes(libraryImages[location.toLowerCase()])) {
                    libraryRefUrls.push(libraryImages[location.toLowerCase()]);
                }

                // Combine: Library First, then Clip Refs
                const refUrls = [...libraryRefUrls, ...clipRefUrls];
                const processedRefs = refUrls.join(',');

                const resultUrlRaw = getValue(row, clipsSheet.headers, 'Result URL');

                return {
                    id: index.toString(), // Use original index (from clipsRows) as ID
                    scene: getValue(row, clipsSheet.headers, 'Scene #'),
                    status: getValue(row, clipsSheet.headers, 'Status'),
                    title: getValue(row, clipsSheet.headers, 'Title'),
                    character: character,
                    location: location,
                    style: getValue(row, clipsSheet.headers, 'Style'),
                    camera: getValue(row, clipsSheet.headers, 'Camera'),
                    action: getValue(row, clipsSheet.headers, 'Action'),
                    dialog: getValue(row, clipsSheet.headers, 'Dialog'),
                    refImageUrls: processedRefs,
                    // Validate Result URL
                    resultUrl: (resultUrlRaw && (resultUrlRaw.startsWith('http') || resultUrlRaw.length < 100))
                        ? convertDriveUrl(resultUrlRaw)
                        : '',
                    seed: getValue(row, clipsSheet.headers, 'Seed'),
                    episode: getValue(row, clipsSheet.headers, 'Episode') || '1',
                    series: getValue(row, clipsSheet.headers, 'Series') || '1',
                    sortOrder: parseInt(getValue(row, clipsSheet.headers, 'Sort Order')) || 0,
                };
            })
            .sort((a, b) => {
                // Sort by Sort Order first, then by original index (stable sort)
                if (a.sortOrder !== 0 || b.sortOrder !== 0) {
                    return (a.sortOrder || 0) - (b.sortOrder || 0);
                }
                return parseInt(a.id) - parseInt(b.id);
            });

        // Build Series List
        const series: Series[] = seriesSheet.rows.map(row => {
            const seriesId = getValue(row, seriesSheet.headers, 'Series #');
            // Calculate current episodes from the episodes list we just built
            const episodeCount = episodes.filter(e => e.series === seriesId).length;

            return {
                id: seriesId,
                title: getValue(row, seriesSheet.headers, 'Title'),
                totalEpisodes: getValue(row, seriesSheet.headers, 'Total Episodes'),
                currentEpisodes: episodeCount.toString(), // Override sheet value
                status: getValue(row, seriesSheet.headers, 'Status')
            };
        }).filter(s => s.id && s.title);

        // Build Library List for Frontend
        const libraryItems = librarySheet.rows.map((row, index) => ({
            id: index.toString(), // Original row index
            type: getValue(row, librarySheet.headers, 'Type'),
            name: getValue(row, librarySheet.headers, 'Name'),
            description: getValue(row, librarySheet.headers, 'Description'),
            refImageUrl: convertDriveUrl(getValue(row, librarySheet.headers, 'Ref Image URLs')),
            negatives: getValue(row, librarySheet.headers, 'Negatives'),
            notes: getValue(row, librarySheet.headers, 'Notes'),
            episode: getValue(row, librarySheet.headers, 'Episode') || '1',
            series: getValue(row, librarySheet.headers, 'Series') || '1'
        })).filter(item => item.name && item.name !== 'Name' && item.type !== 'Type');

        return NextResponse.json({ clips, episodeTitles, episodes, libraryItems, series });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
