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
            db.studioItem.findMany({
                include: {
                    media: {
                        where: { category: 'STUDIO_UPLOAD' }, // Or just take all attached to it?
                        orderBy: { id: 'desc' }
                    }
                },
                orderBy: { name: 'asc' } // CRITICAL: Sort by Name for UI stability (Duplicates appear adjacent)
            }),
            db.clip.findMany({
                include: {
                    episode: { include: { series: true } },
                    mediaResults: {
                        orderBy: { createdAt: 'asc' } // Ensure youngest is [length - 1]
                    },
                    mediaReferences: {
                        include: { studioItem: true }, // Include Studio Item for Titles/URLs
                        orderBy: [
                            { refImageSort: 'desc' }, // Phase 2: Prioritize flagged items
                            { id: 'desc' }            // Then LIFO
                        ]
                    },
                    modelInputSlots: {
                        include: {
                            media: { include: { studioItem: true } },
                            studioItem: {
                                include: {
                                    media: {
                                        where: { category: 'STUDIO_UPLOAD' },
                                        orderBy: { id: 'desc' }
                                    }
                                }
                            }
                        },
                        orderBy: { sortOrder: 'asc' }
                    }
                },
                orderBy: [
                    { sortOrder: 'asc' },
                    { id: 'asc' }
                ]
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
        const libraryItems = dbStudioItems.map(item => {
            // READER SWITCH: Use Media Table (Latest) -> Legacy
            // @ts-ignore
            const mediaUrl = (item.media && item.media.length > 0) ? item.media[0].url : item.refImageUrl;

            return {
                id: item.id.toString(),
                type: item.type,
                name: item.name,
                description: item.description || '',
                refImageUrl: mediaUrl || '', // Source from Media
                negatives: item.negatives || '',
                notes: item.notes || '',
                episode: item.episode || '1',
                series: item.seriesId,
                model: item.model || null,
                // CRITICAL: Include status and taskId for polling loop to work
                status: item.status || 'IDLE',
                taskId: item.taskId || ''
            };
        });

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

            // READER MIGRATION: Prefer Media Table (New) over Legacy Columns
            // ---------------------------------------------------------------

            // A. Resolve Results (Video/Image)
            // Use logical last item (most recent) from Media table.
            // LEGACY FALLBACK: If not migrated to Media, fallback to raw clip.resultUrl.
            // SMART FILTER: Do NOT select a dead remote tempfile.aiquickdraw.com URL if a local alternative exists.
            let mediaResult = '';
            if (clip.mediaResults && clip.mediaResults.length > 0) {
                // Find highest priority: Local / persistent URL (Search from newest to oldest)
                const goodResult = [...clip.mediaResults].reverse().find((m: any) => !m.url.includes('tempfile.aiquickdraw.com'));
                if (goodResult) {
                    mediaResult = goodResult.url;
                } else {
                    // All media results are dead tempfiles. We must fallback to legacy resultUrl if valid.
                    mediaResult = clip.resultUrl || clip.mediaResults[clip.mediaResults.length - 1].url;
                }
            } else {
                mediaResult = clip.resultUrl || '';
            }

            // B. Resolve References (Images)
            // C. Enrich Studio References (Fresh URL from Library)
            const enrichedMediaReferences = (clip.mediaReferences || []).map((m: any) => {
                if (m.category === 'STUDIO_REFERENCE' && m.studioItem && m.studioItem.refImageUrl) {
                    // Use fresh URL from Studio Item, parsing CSV if needed
                    // @ts-ignore
                    const parts = m.studioItem.refImageUrl.split(',');
                    return { ...m, url: parts[0] || m.url };
                }
                return m;
            });

            // Media Table is the ONLY source of truth
            const explicitRefs = enrichedMediaReferences.length > 0
                ? enrichedMediaReferences.filter((m: any) => m.category === 'REFERENCE' || m.refImageSort > 0).map((m: any) => m.url).join(',')
                : '';

            // Proxy Clip for Resolver (library image resolution still needs this shape)
            const proxyClip = { ...clip, mediaReferences: enrichedMediaReferences || [] };
            const { characterImageUrls, locationImageUrls } = resolveClipImages(proxyClip, findLib);

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
                // Resolved Images (Source of Truth = Media Table)
                mediaReferences: enrichedMediaReferences,
                // Enrich modelInputSlots: resolve studioItem image URLs from Media table
                modelInputSlots: (clip.modelInputSlots || []).map((slot: any) => {
                    if (slot.studioItem) {
                        const studioMedia = slot.studioItem.media;
                        const resolvedUrl = (studioMedia && studioMedia.length > 0) ? studioMedia[0].url : slot.studioItem.refImageUrl;
                        return {
                            ...slot,
                            studioItem: {
                                ...slot.studioItem,
                                refImageUrl: resolvedUrl || slot.studioItem.refImageUrl || '',
                                media: undefined // Don't leak nested media array to frontend
                            }
                        };
                    }
                    return slot;
                }),
                mediaResults: clip.mediaResults,
                characterImageUrls,
                locationImageUrls,
                // Result (Source of Truth = Media Table)
                resultUrl: mediaResult || '',
                remoteResultUrl: clip.resultUrl || '', // Exposed to allow frontend to exclude legacy remote URLs from pool
                taskId: clip.taskId || '',
                seed: clip.seed || '',
                negativePrompt: clip.negativePrompt || '',
                episode: clip.episode.number.toString(),
                episodeId: clip.episodeId, // UUID for persistence context
                series: seriesId,
                sortOrder: clip.sortOrder,
                model: clip.model || '',
                isHiddenInStoryboard: clip.isHiddenInStoryboard || false,
                isSelected: clip.isSelected || false, // Added for persistence
                isPersisted: clip.isPersisted || false, // REQUIRED for UI Traffic Light to know it's complete
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
                // refImageUrls: clip.explicitRefUrls || '', // LEGACY: Removed
                episodeId: dbEpisode.id,
                sortOrder: clip.sortOrder || 0,
                // @ts-ignore
                negativePrompt: clip.negativePrompt || '',
                // If initializing with a resultUrl (rare for new clips, but refined here)
                // resultUrl: clip.resultUrl || undefined, // LEGACY: Removed
            },
            include: { episode: true }
        });

        // Async Thumbnail Generation
        if (newClip.resultUrl) {
            // 1. Generate Thumbnail (Async)
            generateThumbnail(newClip.resultUrl, newClip.id.toString())
                .then(async (thumbnailPath) => {
                    if (thumbnailPath) {
                        await db.clip.update({
                            where: { id: newClip.id },
                            data: { thumbnailPath }
                        });
                        console.log(`Thumbnail generated for NEW clip ${newClip.id}: ${thumbnailPath}`);
                    }
                });

            // 2. Create Media Record (CRITICAL for GET to see it)
            // We trust the URL provided (Cloning/Sideloading scenario)
            await db.media.create({
                data: {
                    url: newClip.resultUrl,
                    type: 'VIDEO', // Default to Video for Results upon cloning, or check ext? 
                    // Actually, let's assume video if usually generated. Or regex.
                    category: 'RESULT',
                    resultForClipId: newClip.id,
                    episodeId: dbEpisode.id
                }
            });
        }

        // 3. Duplicate Reference Media from source clip (NEW)
        // @ts-ignore - sourceClipId passed from frontend during duplication
        if (clip.sourceClipId) {
            const sourceId = parseInt(clip.sourceClipId);

            if (!isNaN(sourceId)) {
                // Find all reference Media for source clip
                const sourceReferences = await db.media.findMany({
                    where: {
                        referenceForClipId: sourceId,
                        category: 'REFERENCE'
                    }
                });

                // Create duplicates for new clip
                for (const ref of sourceReferences) {
                    await db.media.create({
                        data: {
                            url: ref.url,
                            localPath: ref.localPath,
                            type: ref.type,
                            category: 'REFERENCE',
                            referenceForClipId: newClip.id,
                            episodeId: dbEpisode.id,
                            mimeType: ref.mimeType,
                            size: ref.size,
                            width: ref.width,
                            height: ref.height
                        }
                    });
                }

                console.log(`[Duplicate] Copied ${sourceReferences.length} reference Media records to clip ${newClip.id}`);
            }
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
                mediaReferences: [] // New clip has no refs yet
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

        console.log('[API] PUT Clip Update:', { id: intId, location: clip.location, character: clip.character });

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
                movement: clip.movement,
                action: clip.action,
                dialog: clip.dialog,
                status: clip.status,
                // refImageUrls: clip.explicitRefUrls, // LEGACY: Removed
                // @ts-ignore
                negativePrompt: clip.negativePrompt,
                // resultUrl: clip.resultUrl, // LEGACY: Removed
                isHiddenInStoryboard: clip.isHiddenInStoryboard,
                isSelected: clip.isSelected, // Added per user request for persistence
                modelInputSlots: clip.modelInputSlots ? {
                    deleteMany: {},
                    create: clip.modelInputSlots.map((slot: any, index: number) => ({
                        mediaId: slot.studioItemId ? null : (slot.mediaId || slot.id), // Fallback safely
                        studioItemId: slot.studioItemId || null,
                        sortOrder: typeof slot.sortOrder === 'number' ? slot.sortOrder : index
                    }))
                } : undefined
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
            include: {
                episode: true,
                mediaReferences: {
                    include: { studioItem: true },
                    orderBy: [
                        { refImageSort: 'desc' },
                        { id: 'desc' }
                    ]
                }
            }
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
            const resolverInput = {
                character: updatedClip.character,
                location: updatedClip.location,
                mediaReferences: clipWithContext.mediaReferences || []
            };

            const { characterImageUrls, locationImageUrls } = resolveClipImages(resolverInput, findLib);

            const finalClip = {
                ...updatedClip,
                id: updatedClip.id.toString(),
                episode: clipWithContext.episode.number.toString(),
                episodeId: updatedClip.episodeId,
                characterImageUrls,
                locationImageUrls,
                mediaReferences: clipWithContext.mediaReferences // We should technically enrich here too, but PUT usually follows an update where DB is fresh-ish.
                // Actually, let's keep it simple for now. The main GET does the heavy lifting.
                // The PUT returns the *just updated* item, which theoretically has the right URL if we just synced it?
                // No, sync creates it with current URL. So it's fine.
            };

            return NextResponse.json({ success: true, clip: finalClip });
        }

        return NextResponse.json({
            success: true,
            clip: {
                ...updatedClip,
                mediaReferences: []
            }
        });

    } catch (error: any) {
        console.error('PUT Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ALIAS PATCH -> PUT (Frontend uses PATCH for partial updates)
export async function PATCH(req: Request) {
    return PUT(req);
}

