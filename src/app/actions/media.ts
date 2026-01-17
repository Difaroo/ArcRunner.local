'use server';

import { db } from '@/lib/db';
import { Media } from '@prisma/client';

export type MediaFilter = {
    type?: 'IMAGE' | 'VIDEO';
    category?: 'RESULT' | 'REFERENCE';
    seriesId?: string;
    episodeId?: string;
};

export async function fetchMedia(filter: MediaFilter, page = 1, limit = 50) {
    const where: any = {};

    if (filter.type) where.type = filter.type;
    if (filter.category) where.category = filter.category;

    // SIMPLIFIED: Use direct episodeId on Media table (after migration)
    // Previously this required complex OR joins through Clip/StudioItem relations
    if (filter.episodeId) {
        where.episodeId = filter.episodeId;
    } else if (filter.seriesId) {
        // For series-level filtering, we still need to join through episode
        where.episode = {
            seriesId: filter.seriesId
        };
    }

    const items = await db.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        include: {
            resultForClip: { include: { episode: true } },
            referenceForClip: { include: { episode: true } },
            studioItem: true
        }
    });

    const total = await db.media.count({ where });

    return { items, total, page, totalPages: Math.ceil(total / limit) };
}

export async function deleteMedia(mediaId: string) {
    await db.media.delete({ where: { id: mediaId } });
    return { success: true };
}
