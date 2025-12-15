import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { convertDriveUrl } from '@/lib/utils';

// Types (Keep for compatibility if needed, though mostly inferred now)
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
    explicitRefUrls: string;
    characterImageUrls?: string[];
    locationImageUrls?: string[];
    status: string;
    resultUrl?: string;
    seed?: string;
    episode?: string;
    series?: string;
    sortOrder?: number;
    model?: string;
}

export async function GET() {
    try {
        console.log('API /api/clips called (DB Mode)');

        // 1. Fetch All Data in Parallel
        const [dbSeries, dbEpisodes, dbStudioItems, dbClips] = await Promise.all([
            db.series.findMany(),
            db.episode.findMany(),
            db.studioItem.findMany(),
            db.clip.findMany({
                include: { episode: { include: { series: true } } },
                orderBy: { sortOrder: 'asc' }
            })
        ]);

        // 2. Transform Series
        const series = dbSeries.map(s => ({
            id: s.id, // UUID now, check if frontend handles string IDs ok? Yes, it did string IDs from sheets '1', '2'.
            // Wait, previous IDs were '1', '2'. Now they are UUIDs. 
            // Frontend might expect '1'. 
            // The Frontend uses these IDs to filter. If we change them, URL dicts might break?
            // "Series #" in sheet was '1'.
            // In migration, we mapped '1' -> UUID.
            // If the frontend relies on '1', we have a problem unless we expose the mapped ID or handle it.
            // Actually, the Frontend likely receives the list of Series and uses their IDs for select boxes.
            // So if we send UUIDs, the select box will use UUIDs.
            // However, OLD links or saved selections might break?
            // "Series" column in Clips table -> references the ID.
            title: s.name,
            totalEpisodes: s.totalEpisodes?.toString() || '0',
            currentEpisodes: '0', // Recalculate below
            status: s.status || ''
        }));

        // 3. Transform Episodes
        const episodes = dbEpisodes.map(e => ({
            series: e.seriesId,
            id: e.number.toString(),
            uuid: e.id,
            title: e.title || `Episode ${e.number}`,
            model: e.model || ''
        }));

        const episodeTitles: Record<string, string> = {};
        dbEpisodes.forEach(e => {
            episodeTitles[e.number.toString()] = e.title || `Episode ${e.number}`;
        });

        // 4. Transform Studio Items (Library)
        const libraryItems = dbStudioItems.map(item => ({
            id: item.id.toString(),
            type: item.type, // "LIB_CHARACTER" etc. Frontend checks "includes('Character')"
            name: item.name,
            description: item.description || '',
            refImageUrl: item.refImageUrl || '',
            negatives: item.negatives || '',
            notes: item.notes || '',
            episode: item.episode || '1', // String reference
            series: item.seriesId // UUID
        }));

        // Helper for Studio Lookups
        // We need to map Name -> Image URL for automatic resolution
        const libraryImages: Record<string, Record<string, string>> = {};
        libraryItems.forEach(item => {
            if (item.name && item.refImageUrl) {
                if (!libraryImages[item.series]) libraryImages[item.series] = {};
                libraryImages[item.series][item.name.toLowerCase()] = item.refImageUrl;
            }
        });


        // 5. Transform Clips
        const clips = dbClips.map(clip => {
            // Reconstruct "Smart" Image URLs (Explicit + Library)
            // The DB stores "refImageUrls" as the Explicit ones (from the migration script).
            // Or did we store both? 
            // Migration script: "refImageUrls: getVal(row, cSheet.headers, 'Ref Image URLs')"
            // It just stored what was in the column.
            // Logic must replicate "Library Lookup".

            const explicitRefUrls = (clip.refImageUrls || '').split(',').map(u => u.trim()).filter(Boolean);
            const libraryRefUrls: string[] = [];
            const characterImageUrls: string[] = [];
            const locationImageUrls: string[] = [];

            const seriesId = clip.episode.seriesId;
            const seriesLib = libraryImages[seriesId] || {};

            // Character Lookup
            if (clip.character) {
                clip.character.split(',').map(c => c.trim().toLowerCase()).forEach(name => {
                    if (seriesLib[name]) {
                        const url = seriesLib[name];
                        if (!characterImageUrls.includes(url)) characterImageUrls.push(url);
                        if (!libraryRefUrls.includes(url) && !explicitRefUrls.includes(url)) {
                            libraryRefUrls.push(url);
                        }
                    }
                });
            }

            // Location Lookup
            if (clip.location) {
                const locName = clip.location.toLowerCase();
                if (seriesLib[locName]) {
                    const url = seriesLib[locName];
                    if (!locationImageUrls.includes(url)) locationImageUrls.push(url);
                    if (!libraryRefUrls.includes(url) && !explicitRefUrls.includes(url)) {
                        libraryRefUrls.push(url);
                    }
                }
            }

            const allRefs = [...libraryRefUrls, ...explicitRefUrls].join(',');

            return {
                id: clip.id.toString(), // DB ID is Int, convert to String
                scene: clip.scene || '',
                status: clip.status,
                title: clip.title || '',
                character: clip.character || '',
                location: clip.location || '',
                style: clip.style || '',
                camera: clip.camera || '',
                action: clip.action || '',
                dialog: clip.dialog || '',
                refImageUrls: allRefs,
                explicitRefUrls: clip.refImageUrls || '',
                characterImageUrls,
                locationImageUrls,
                resultUrl: clip.resultUrl || '',
                seed: clip.seed || '',
                episode: clip.episode.number.toString(), // Return NUMBER string '1', not UUID, to match UI expectations?
                // WARNING: If we return '1', but filtering expects something else...
                // The frontend filters clips by `clip.episode === selectedEpisode`.
                // If the Episode List returns UUIDs, filtering breaks.
                // If Episode List returns '1', '2', then filtering works.
                // Let's stick to "Episode Number" (String) for the 'episode' field in Clip JSON.
                series: seriesId,
                sortOrder: clip.sortOrder,
                model: clip.model || ''
            };
        });

        // Update Series Episode Counts
        series.forEach(s => {
            // Count unique Clip.Episodes or DB Episodes?
            // DB Episodes
            const count = dbEpisodes.filter(e => e.seriesId === s.id).length;
            s.currentEpisodes = count.toString();
        });


        return NextResponse.json({ clips, episodeTitles, episodes: episodes.map(e => ({ ...e, id: e.id })), libraryItems, series });

    } catch (error: any) {
        console.error('API Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

