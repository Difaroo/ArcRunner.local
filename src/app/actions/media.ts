'use server';

import { db } from '@/lib/db';
import { Media } from '@prisma/client';
import { deleteFileFromUrl } from '@/lib/storage';

export type MediaFilter = {
    type?: 'IMAGE' | 'VIDEO';
    category?: 'RESULT' | 'REFERENCE';
    seriesId?: string;
    episodeId?: string;
};

import { Prisma } from '@prisma/client';

export async function fetchMedia(filter: MediaFilter, page = 1, limit = 50) {
    // 1. Build Dynamic WHERE Conditions
    const conditions: Prisma.Sql[] = [];

    if (filter.type) {
        conditions.push(Prisma.sql`m.type = ${filter.type}`);
    }
    if (filter.category) {
        conditions.push(Prisma.sql`m.category = ${filter.category}`);
    }

    // Episode/Series Filtering
    // Note: We prioritize the direct Episode link on Media if available, 
    // but we join tables to be safe for sorting anyway.
    if (filter.episodeId) {
        conditions.push(Prisma.sql`m.episodeId = ${filter.episodeId}`);
    } else if (filter.seriesId) {
        // Filter by Series (via Episode relation)
        conditions.push(Prisma.sql`e.seriesId = ${filter.seriesId}`);
    }

    const whereClause = conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.sql``;

    // 2. Fetch IDs with Strict Sort Order
    // Sort Priority:
    // 1. Series Name (Grouping)
    // 2. Episode Number (Grouping)
    // 3. Clip Sort Order (Interleaving Results & Refs)
    // 4. Creation Date (Fallback/Secondary)
    const offset = (page - 1) * limit;

    const idsQuery = Prisma.sql`
        SELECT m.id
        FROM Media m
        LEFT JOIN Episode e ON m.episodeId = e.id
        LEFT JOIN Series s ON e.seriesId = s.id
        LEFT JOIN Clip cRes ON m.resultForClipId = cRes.id
        LEFT JOIN Clip cRef ON m.referenceForClipId = cRef.id
        ${whereClause}
        ORDER BY 
            s.name ASC,
            e.number ASC,
            -- Coalesce sort orders: Matches visualization logic
            -- Use a large number (999999) for nulls so unlinked items fall to bottom
            COALESCE(cRes.sortOrder, cRef.sortOrder, 999999) ASC,
            m.createdAt DESC
        LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = Prisma.sql`
        SELECT COUNT(m.id) as total
        FROM Media m
        LEFT JOIN Episode e ON m.episodeId = e.id
        LEFT JOIN Series s ON e.seriesId = s.id
        ${whereClause}
    `;

    try {
        const [rawIds, rawCount] = await Promise.all([
            db.$queryRaw<{ id: string }[]>(idsQuery),
            db.$queryRaw<{ total: bigint }[]>(countQuery)
        ]);

        const ids = (rawIds as any[]).map(r => r.id);
        const total = Number((rawCount as any[])[0]?.total || 0);

        // 3. Hydrate Objects
        // We fetch full objects for the IDs we found
        const itemsMap = new Map();
        if (ids.length > 0) {
            const items = await db.media.findMany({
                where: { id: { in: ids } },
                include: {
                    resultForClip: { include: { episode: true } },
                    referenceForClip: { include: { episode: true } },
                    studioItem: true,
                    // Optionally include episode directly if needed for UI, generally standardized on Result/Ref links
                    episode: true
                }
            });
            items.forEach(item => itemsMap.set(item.id, item));
        }

        // 4. Re-Apply Sort Order
        // The IN query doesn't guarantee order, so we map back to original ID list
        const orderedItems = ids.map(id => itemsMap.get(id)).filter(Boolean);

        return { items: orderedItems, total, page, totalPages: Math.ceil(total / limit) };

    } catch (e) {
        console.error("Error fetching media:", e);
        return { items: [], total: 0, page, totalPages: 0 };
    }
}

export async function deleteMedia(mediaId: string) {
    const media = await db.media.findUnique({ where: { id: mediaId } });
    if (!media) return { success: false, error: 'Media not found' };

    // Delete the physical files first
    if (media.localPath) await deleteFileFromUrl(media.localPath);
    if (!media.localPath && media.url) await deleteFileFromUrl(media.url);
    if (media.thumbnailPath) await deleteFileFromUrl(media.thumbnailPath);

    await db.media.delete({ where: { id: mediaId } });
    return { success: true };
}
