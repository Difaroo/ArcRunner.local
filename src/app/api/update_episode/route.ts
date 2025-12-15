import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { seriesId, episodeId, updates } = await request.json();

        if (!seriesId || !episodeId || !updates) {
            return NextResponse.json({ error: 'Missing seriesId, episodeId, or updates' }, { status: 400 });
        }

        // 1. Find the Episode
        // Frontend sends episodeId as Number String "1"
        const epNum = parseInt(episodeId);
        if (isNaN(epNum)) {
            return NextResponse.json({ error: 'Invalid Episode Number' }, { status: 400 });
        }

        const episode = await db.episode.findFirst({
            where: {
                seriesId: seriesId,
                number: epNum
            }
        });

        if (!episode) {
            return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
        }

        // 2. Perform Updates
        // Map frontend fields if necessary. 
        // Frontend sends: 'model', 'title'. 
        // Prisma has: 'model', 'title'. Matches.

        await db.episode.update({
            where: { id: episode.id },
            data: updates
        });

        return NextResponse.json({ success: true, rowIndex: episode.id });

    } catch (error: any) {
        console.error('Update Episode Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

