import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { convertDriveUrl } from '@/lib/utils';
import { resolveClipImages } from '@/lib/shared-resolvers';
import { generateThumbnail } from '@/lib/thumbnail-generator';

import { Clip, Series } from '@/types';



export async function GET() {
    try {
        console.log('API /api/clips called (DB Mode)');

        // 1. Fetch All Data in Parallel
        const [dbSeries, dbEpisodes, dbStudioItems, dbClips] = await Promise.all([
            db.series.findMany(),
            db.episode.findMany({ orderBy: { number: 'asc' } }),
            db.studioItem.findMany(),
            db.clip.findMany({
                include: { episode: { include: { series: true } } },
                orderBy: { sortOrder: 'asc' }
            })
        ]);

        // 2. Transform Series
        const series = dbSeries.map(s => ({
            id: s.id,
            title: s.name,
            totalEpisodes: s.totalEpisodes?.toString() || '0',
            currentEpisodes: '0',
            status: s.status || '',
            defaultModel: s.defaultModel || 'veo-fast'
        }));

        // 3. Transform Episodes
        const episodes = dbEpisodes.map(e => ({
            series: e.seriesId,
            id: e.number.toString(),
            uuid: e.id,
            title: e.title || `Episode ${e.number}`,
            model: e.model || '',
            aspectRatio: e.aspectRatio || '16:9',
            style: e.style || '',
            guidance: e.guidance ?? 5.0,
            seed: e.seed || null
        }));

        const episodeTitles: Record<string, string> = {};
        dbEpisodes.forEach(e => {
            episodeTitles[e.number.toString()] = e.title || `Episode ${e.number}`;
        });

        // 4. Transform Studio Items (Library)
        const libraryItems = dbStudioItems.map(item => ({
            id: item.id.toString(),
            type: item.type,
            name: item.name,
            description: item.description || '',
            refImageUrl: item.refImageUrl || '',
            negatives: item.negatives || '',
            notes: item.notes || '',
            episode: item.episode || '1',
            series: item.seriesId
        }));

        // Helper for Studio Lookups
        const libraryImages: Record<string, Record<string, string>> = {}; // SeriesID -> Name -> URL
        const globalLibrary: Record<string, string> = {}; // Name -> URL (Last one wins, fallback)

        libraryItems.forEach(item => {
            if (item.name && item.refImageUrl) {
                const cleanName = item.name.trim().toLowerCase();

                // 1. Scoped Map
                if (!libraryImages[item.series]) libraryImages[item.series] = {};
                libraryImages[item.series][cleanName] = item.refImageUrl;

                // 2. Global Fallback Map
                // We populate this so if a clip references a character from ANOTHER series, we can still find it.
                // Ideally, names should be unique or we prefer the current series one (handled in lookup order).
                globalLibrary[cleanName] = item.refImageUrl;
            }
        });


        // 5. Transform Clips
        const clips = dbClips.map((clip: any) => {
            // Defensive Coding: Skip clips with broken relations
            if (!clip.episode) {
                console.warn(`Orphan clip found (ID: ${clip.id}). Skipping.`);
                return null;
            }
            const seriesId = clip.episode.seriesId;
            const seriesLib = libraryImages[seriesId] || {};

            const findLib = (name: string) => {
                const key = name.toLowerCase();
                // Priority: Current Series > Global Fallback
                return seriesLib[key] || globalLibrary[key];
            };

            const { fullRefs, explicitRefs, characterImageUrls, locationImageUrls } = resolveClipImages(clip, findLib);

            const allRefs = fullRefs;

            return {
                id: clip.id.toString(),
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
                explicitRefUrls: explicitRefs || (clip.refImageUrls || ''),
                characterImageUrls,
                locationImageUrls,
                resultUrl: clip.resultUrl || '',
                taskId: clip.taskId || '',
                seed: clip.seed || '',
                negativePrompt: clip.negativePrompt || '',
                episode: clip.episode.number.toString(),
                series: seriesId,
                sortOrder: clip.sortOrder,
                model: clip.model || '',
                isHiddenInStoryboard: clip.isHiddenInStoryboard || false,
                thumbnailPath: clip.thumbnailPath || ''
            };
        }).filter((c: any): c is NonNullable<typeof c> => c !== null); // Remove orphans

        // Update Series Episode Counts
        series.forEach(s => {
            const count = dbEpisodes.filter(e => e.seriesId === s.id).length;
            s.currentEpisodes = count.toString();
        });


        return NextResponse.json({ clips, episodeTitles, episodes: episodes.map(e => ({ ...e, id: e.id })), libraryItems, series });

    } catch (error: any) {
        console.error('API Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { id } = await req.json();
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const intId = parseInt(id);
        if (isNaN(intId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

        await db.clip.delete({
            where: { id: intId }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { clip } = await req.json();

        // Validate required fields
        if (!clip.episode || !clip.series) {
            return NextResponse.json({ error: 'Episode and Series are required' }, { status: 400 });
        }

        const seriesId = clip.series;
        const episodeNum = parseInt(clip.episode); // "1" -> 1

        const dbEpisode = await db.episode.findFirst({
            where: {
                seriesId: seriesId,
                number: episodeNum
            }
        });

        if (!dbEpisode) {
            return NextResponse.json({ error: `Episode ${episodeNum} not found for Series ${seriesId}` }, { status: 404 });
        }

        const newClip = await db.clip.create({
            data: {
                scene: clip.scene,
                title: clip.title,
                character: clip.character,
                location: clip.location,
                style: clip.style,
                camera: clip.camera,
                action: clip.action,
                dialog: clip.dialog,
                status: clip.status || 'Ready',
                refImageUrls: clip.explicitRefUrls || '', // Store explicit only
                episodeId: dbEpisode.id,
                sortOrder: clip.sortOrder || 0,
                // @ts-ignore
                negativePrompt: clip.negativePrompt || '',
                // If initializing with a resultUrl (rare for new clips, but refined here)
                // @ts-ignore
                resultUrl: clip.resultUrl || undefined,
            },
            include: { episode: true }
        });

        // Async Thumbnail Generation
        // @ts-ignore
        if (newClip.resultUrl) {
            // @ts-ignore
            generateThumbnail(newClip.resultUrl, newClip.id.toString())
                .then(async (thumbnailPath) => {
                    if (thumbnailPath) {
                        await db.clip.update({
                            // @ts-ignore
                            where: { id: newClip.id },
                            data: { thumbnailPath }
                        });
                        // @ts-ignore
                        console.log(`Thumbnail generated for NEW clip ${newClip.id}: ${thumbnailPath}`);
                    }
                });
        }

        return NextResponse.json({
            success: true,
            clip: {
                ...clip,
                // @ts-ignore
                id: newClip.id.toString(),
                status: newClip.status,
                // @ts-ignore
                episode: newClip.episode.number.toString(),
                // @ts-ignore
                refImageUrls: newClip.refImageUrls, // Note: This is Explicit only for POST usually, but consistent with DB
                // @ts-ignore
                explicitRefUrls: newClip.refImageUrls // Explicitly return this for frontend logic
            }
        });

    } catch (error: any) {
        console.error('POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { clip } = await req.json();

        if (!clip.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
        const intId = parseInt(clip.id);

        // Update the clip
        const updatedClip = await db.clip.update({
            where: { id: intId },
            data: {
                scene: clip.scene,
                title: clip.title,
                character: clip.character,
                location: clip.location,
                style: clip.style,
                camera: clip.camera,
                action: clip.action,
                dialog: clip.dialog,
                status: clip.status,
                refImageUrls: clip.explicitRefUrls,
                // @ts-ignore
                negativePrompt: clip.negativePrompt,
                // @ts-ignore
                resultUrl: clip.resultUrl,
                isHiddenInStoryboard: clip.isHiddenInStoryboard
            }
        });

        // Helper to check if we need to generate a thumbnail
        // 1. We have a resultUrl
        // 2. AND (We don't have a thumbnail OR The resultUrl changed OR we are forced)
        // For now, simpler: If resultUrl touches, try generating if missing? 
        // Or just always try if resultUrl is present? 
        // Better: If resultUrl exists, run generation. It's fast enough.
        // Even better: Check if we already have one?
        // Let's just generate if resultUrl is present and we are updating it.

        if (clip.resultUrl && clip.resultUrl !== '') {
            generateThumbnail(clip.resultUrl, intId.toString())
                .then(async (thumbnailPath) => {
                    if (thumbnailPath) {
                        await db.clip.update({
                            where: { id: intId },
                            data: { thumbnailPath }
                        });
                        console.log(`Thumbnail updated for clip ${intId}`);
                    }
                });
        }

        // Fix: Return enriched clip with image URLs so UI updates immediately
        // We need the Episode/Series context to resolve library images
        const clipWithContext = await db.clip.findUnique({
            where: { id: intId },
            include: { episode: true }
        });

        if (clipWithContext) {
            const seriesId = clipWithContext.episode.seriesId;

            // Fetch Library for this series to resolve images
            const libraryItems = await db.studioItem.findMany({
                where: { seriesId: seriesId }
            });

            const libraryImages: Record<string, string> = {};
            libraryItems.forEach(item => {
                if (item.name && item.refImageUrl) {
                    // Apply SAFE trim logic here too
                    libraryImages[item.name.trim().toLowerCase()] = item.refImageUrl;
                }
            });

            const findLib = (name: string) => libraryImages[name.toLowerCase()];

            // Safely resolve using the helper
            // valid clipWithContext matches the shape expected by resolveClipImages partial
            // We construct a specific object to pass in to match the interface if needed, 
            // but resolveClipImages takes { character, location, refImageUrls, explicitRefUrls }

            // Map DB fields to Resolver Interface
            const resolverInput = {
                character: updatedClip.character,
                location: updatedClip.location,
                refImageUrls: updatedClip.refImageUrls, // This is technically the explicit list from DB
                explicitRefUrls: updatedClip.refImageUrls // We treat DB column as explicit
            };

            const { fullRefs, characterImageUrls, locationImageUrls } = resolveClipImages(resolverInput, findLib);

            // Return the fully enriched object
            // We mix updatedClip properties with computed ones
            const finalClip = {
                ...updatedClip,
                // Ensure ID is string for frontend consistency if needed (Prisma returns Int, but mapped in GET to string)
                // Frontend likely expects string if it came from GET
                id: updatedClip.id.toString(),
                episode: updatedClip.episodeId, // or clipWithContext.episode.number.toString(), but UI uses flattened structure?
                // Let's match GET structure as close as possible without re-serializing everything if not needed.
                characterImageUrls,
                locationImageUrls,
                refImageUrls: fullRefs,
                explicitRefUrls: updatedClip.refImageUrls // CRITICAL: Propagate DB value as Explicit
            };

            return NextResponse.json({ success: true, clip: finalClip });
        }

        return NextResponse.json({
            success: true,
            clip: {
                ...updatedClip,
                // Ensure Explicit Ref is passed back if we are falling back to simple return
                explicitRefUrls: updatedClip.refImageUrls
            }
        });

    } catch (error: any) {
        console.error('PUT Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

