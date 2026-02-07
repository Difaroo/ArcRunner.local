import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
        console.log('[API] /api/media: Fetching for episodeId:', episodeId);

        // Fetch media linked to the episode
        const media = await prisma.media.findMany({
            where: {
                episodeId: episodeId,
            },
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                id: true,
                url: true,
                type: true,
                mimeType: true,
                category: true,
                episodeId: true
            }
        });

        return NextResponse.json(media);
    } catch (error) {
        console.error('Error fetching media:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
