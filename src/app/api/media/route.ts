import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/media?episodeId=...
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const episodeId = searchParams.get('episodeId');
        const seriesId = searchParams.get('seriesId'); // Optional, fallback/future use

        if (!episodeId) {
            console.log('[API] /api/media: Missing episodeId');
            return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
        }
        console.log('[API] /api/media: Fetching for episodeId:', episodeId, 'seriesId:', seriesId);

        // Fetch media linked to the episode
        const mediaPromise = db.media.findMany({
            where: {
                episodeId: episodeId,
            },
            include: {
                studioItem: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Fetch Studio Items if seriesId is available
        let studioItems: any[] = [];
        let resolvedSeriesId = seriesId;

        // If no seriesId passed, try to get it from Episode
        if (!resolvedSeriesId) {
            const ep = await db.episode.findUnique({
                where: { id: episodeId },
                select: { seriesId: true }
            });
            resolvedSeriesId = ep?.seriesId || null;
        }

        if (resolvedSeriesId) {
            const items = await db.studioItem.findMany({
                where: {
                    seriesId: resolvedSeriesId,
                    OR: [
                        { type: 'CHARACTER' },
                        { type: 'LOCATION' },
                        { type: 'LIB_CHARACTER' },
                        { type: 'LIB_LOCATION' }
                    ]
                }
            });

            // Fetch any Media records linked to these studio items
            // This handles cases where the StudioItem table doesn't have the URL but a Media record does
            const itemIds = items.map(i => i.id);
            const linkedMedia = await db.media.findMany({
                where: {
                    studioItemId: { in: itemIds }
                }
            });

            // Map to Media interface
            studioItems = items.map((item: any) => {
                // Try to find a linked media record first (it might have the real file path)
                const linked = linkedMedia.find(m => m.studioItemId === item.id);
                // Fallback to item fields
                // Cast item to any to avoid "thumbnailPath does not exist" if types are stale
                const rawItem = item as any;
                const bestUrl = linked?.url || rawItem.refImageUrl || rawItem.thumbnailPath || '';
                const bestThumb = linked?.thumbnailPath || rawItem.thumbnailPath || linked?.url || '';

                return {
                    id: `studio_item_${item.id}`,
                    name: item.name, // Fixed: Added missing name field
                    description: item.description || '', // EXPOSE DESCRIPTION
                    url: bestUrl,
                    thumbnailPath: bestThumb,
                    type: 'IMAGE',
                    category: item.type,
                    // Cast/Force properties that might be missing in strict type if not mapped
                    mimeType: 'image/png',
                    size: 0,
                    width: 0,
                    height: 0,
                    createdAt: new Date(),
                    referenceForClipId: null,
                    resultForClipId: null,
                    studioItemId: item.id,
                    episodeId: null,
                    localPath: null,
                    refImageSort: 0,
                    isStudioItem: true
                } as any;
            })
                .filter(item => item.url && item.url.length > 0);
        }

        const mediaRaw = await mediaPromise;

        const media = mediaRaw.map((m: any) => ({
            ...m,
            name: m.studioItem?.name || '', // Expose name for Contextual Matching
            description: m.studioItem?.description || m.prompt || '', // Expose description
            // Ensure compatibility with StudioItem shape if needed
            isStudioItem: false
        }));

        // Combine: Media first? Or Studio first? 
        // Let's put Studio items at the END of the pool
        const combined = [...media, ...studioItems];

        return NextResponse.json(combined);
    } catch (error: any) {
        console.error('Error fetching media:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH /api/media - Update Media Item (e.g. refImageSort)
export async function PATCH(request: NextRequest) {
    try {
        const { id, refImageSort } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // Use unchecked update or any cast to bypass strict typing on dynamic field if needed, 
        // but refImageSort SHOULD exist on Media. 
        // If Prisma complains, it might be due to union types.
        const updated = await db.media.update({
            where: { id: id },
            data: {
                refImageSort: refImageSort !== undefined ? parseInt(refImageSort) : undefined
            } as any
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating media:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
