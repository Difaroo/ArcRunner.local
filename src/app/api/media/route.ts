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

        const mediaRaw = await mediaPromise;

        const media = mediaRaw
            .filter((m: any) => !(m.url && m.url.includes('tempfile.aiquickdraw.com')))
            .map((m: any) => ({
                ...m,
                name: m.studioItem?.name || '', // Expose name for Contextual Matching
                description: m.studioItem?.description || m.prompt || '', // Expose description
                // Ensure compatibility with StudioItem shape if needed
                isStudioItem: false
            }));

        return NextResponse.json(media);
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
