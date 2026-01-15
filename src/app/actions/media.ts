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

    // Complex Filtering: Join to Clip/Studio to filter by Series/Episode
    // This is where Relational DB shines!
    if (filter.seriesId || filter.episodeId) {
        let episodeNumberString: string | undefined;

        // Resolve Episode Number string for matching against StudioItem.episode
        if (filter.episodeId) {
            const ep = await db.episode.findUnique({ where: { id: filter.episodeId } });
            if (ep) {
                episodeNumberString = ep.number.toString();
            }
        }

        where.OR = [
            // 1. Result for Clip
            {
                resultForClip: {
                    episode: {
                        ...(filter.episodeId && { id: filter.episodeId }),
                        ...(filter.seriesId && { seriesId: filter.seriesId })
                    }
                }
            },
            // 2. Reference for Clip
            {
                referenceForClip: {
                    episode: {
                        ...(filter.episodeId && { id: filter.episodeId }),
                        ...(filter.seriesId && { seriesId: filter.seriesId })
                    }
                }
            },
            // 3. Studio Item (Strict Filter)
            {
                studioItem: {
                    seriesId: filter.seriesId,
                    ...(episodeNumberString && { episode: episodeNumberString })
                }
            }
        ];
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
