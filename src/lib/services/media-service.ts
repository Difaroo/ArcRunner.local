import { db } from '../db';
import { Media } from '@prisma/client';
import { parseStringList } from '../utils/string-helpers';

/**
 * MediaService
 * 
 * Responsible for all media CRUD operations.
 * Writes exclusively to the Media table (legacy CSV dual-write removed in v0.33).
 */
export class MediaService {

    /**
     * Records a new Generation Result (Video/Image) for a Clip.
     * Creates a Media record in the Media table.
     */
    static async addResult(clipId: number, url: string, type: 'VIDEO' | 'IMAGE' = 'VIDEO', localPath?: string) {
        const clip = await db.clip.findUnique({ where: { id: clipId }, select: { episodeId: true, resultUrl: true } });
        if (!clip) throw new Error(`Clip ${clipId} not found`);

        // Legacy: still update resultUrl for UI components that read it directly
        let newCsv = url;
        if (clip.resultUrl) {
            newCsv = `${url},${clip.resultUrl}`;
        }

        return await db.$transaction(async (tx) => {
            // Update resultUrl (still used by UI for latest result display)
            await tx.clip.update({
                where: { id: clipId },
                data: { resultUrl: newCsv }
            });

            // Create Media record
            const media = await tx.media.create({
                data: {
                    url: url,
                    type: type,
                    category: 'RESULT',
                    localPath: localPath,
                    resultForClipId: clipId,
                    episodeId: clip.episodeId
                }
            });

            return media;
        });
    }

    /**
     * Records a new Explicit Reference Image for a Clip.
     * Creates a REFERENCE Media record. No CSV writes.
     */
    static async addReference(clipId: number, url: string) {
        const clip = await db.clip.findUnique({ where: { id: clipId }, select: { episodeId: true } });
        if (!clip) throw new Error(`Clip ${clipId} not found`);

        // Determine refImageSort: new ref gets max + 1
        const maxSort = await db.media.aggregate({
            where: { referenceForClipId: clipId },
            _max: { refImageSort: true }
        });
        const nextSort = (maxSort._max.refImageSort ?? 0) + 1;

        return await db.media.create({
            data: {
                url: url,
                type: 'IMAGE',
                category: 'REFERENCE',
                referenceForClipId: clipId,
                episodeId: clip.episodeId,
                refImageSort: nextSort
            }
        });
    }

    /**
     * Retrieves all results for a Clip from the Media table.
     */
    static async getResults(clipId: number): Promise<Media[]> {
        return await db.media.findMany({
            where: { resultForClipId: clipId, category: 'RESULT' },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Synchronizes a CSV list of Reference URLs (from User Edit) with the Media table.
     * Handles Adds and Removes. Media-table-only.
     */
    static async syncReferences(clipId: number, csvUrls: string) {
        const newUrls = parseStringList(csvUrls);
        const newUrlSet = new Set(newUrls);

        const existingMedia = await db.media.findMany({
            where: { referenceForClipId: clipId, category: 'REFERENCE' }
        });
        const existingUrlSet = new Set(existingMedia.map(m => m.url));

        const toAdd = newUrls.filter(url => !existingUrlSet.has(url));
        const toRemove = existingMedia.filter(m => !newUrlSet.has(m.url));

        console.log(`[MediaService] Sync References for Clip ${clipId}: +${toAdd.length} / -${toRemove.length}`);

        return await db.$transaction(async (tx) => {
            if (toRemove.length > 0) {
                await tx.media.deleteMany({
                    where: { id: { in: toRemove.map(m => m.id) } }
                });
            }

            if (toAdd.length > 0) {
                const clipData = await tx.clip.findUnique({ where: { id: clipId }, select: { episodeId: true } });

                // Get current max sort for new refs
                const maxSort = await tx.media.aggregate({
                    where: { referenceForClipId: clipId },
                    _max: { refImageSort: true }
                });
                let nextSort = (maxSort._max.refImageSort ?? 0) + 1;

                await Promise.all(toAdd.map(url => {
                    const sort = nextSort++;
                    return tx.media.create({
                        data: {
                            url: url,
                            type: 'IMAGE',
                            category: 'REFERENCE',
                            referenceForClipId: clipId,
                            episodeId: clipData?.episodeId,
                            refImageSort: sort
                        }
                    });
                }));
            }
        });
    }

    /**
     * Records a new Result (Image/Video) for a Studio Item (Library).
     */
    static async addStudioResult(studioItemId: number, url: string, type: 'IMAGE' | 'VIDEO' = 'IMAGE', localPath?: string) {
        const item = await db.studioItem.findUnique({ where: { id: studioItemId }, select: { refImageUrl: true } });
        if (!item) throw new Error(`StudioItem ${studioItemId} not found`);

        // Legacy: still update refImageUrl for Studio UI
        let newCsv = url;
        if (item.refImageUrl) {
            newCsv = `${url},${item.refImageUrl}`;
        }

        return await db.$transaction(async (tx) => {
            await tx.studioItem.update({
                where: { id: studioItemId },
                data: { refImageUrl: newCsv }
            });

            const media = await tx.media.create({
                data: {
                    url: url,
                    type: type,
                    category: 'STUDIO_UPLOAD',
                    localPath: localPath,
                    studioItemId: studioItemId
                }
            });

            return media;
        });
    }

    /**
     * Synchronizes Studio Item Reference Images with the Media table.
     */
    static async syncStudioReferences(studioItemId: number, csvUrls: string) {
        const newUrls = parseStringList(csvUrls);
        const newUrlSet = new Set(newUrls);

        const existingMedia = await db.media.findMany({
            where: { studioItemId: studioItemId, category: 'STUDIO_UPLOAD' }
        });
        const existingUrlSet = new Set(existingMedia.map(m => m.url));

        const toAdd = newUrls.filter(url => !existingUrlSet.has(url));
        const toRemove = existingMedia.filter(m => !newUrlSet.has(m.url));

        console.log(`[MediaService] Sync Studio References for Item ${studioItemId}: +${toAdd.length} / -${toRemove.length}`);

        return await db.$transaction(async (tx) => {
            if (toRemove.length > 0) {
                await tx.media.deleteMany({
                    where: { id: { in: toRemove.map(m => m.id) } }
                });
            }

            if (toAdd.length > 0) {
                await Promise.all(toAdd.map(url => tx.media.create({
                    data: {
                        url: url,
                        type: 'IMAGE',
                        category: 'STUDIO_UPLOAD',
                        studioItemId: studioItemId
                    }
                })));
            }
        });
    }
    /**
     * Synchronizes a Clip's Studio Items (Characters/Locations) with the Media table.
     * Creates/Deletes STUDIO_REFERENCE Media records.
     */
    static async syncClipStudioItems(clipId: number, type: 'CHARACTER' | 'LOCATION', names: string[]) {
        const validNames = names.filter(n => n && n.trim().length > 0);

        // 1. Resolve Names to Studio Items
        // We use 'contains' loosely or exact match? Studio names are usually exact in the UI dropdowns.
        const studioItems = await db.studioItem.findMany({
            where: {
                name: { in: validNames },
                type: type === 'CHARACTER' ? 'LIB_CHARACTER' : 'LIB_LOCATION'
            }
        });

        // Map found items by ID for easy lookup
        const foundItemIds = studioItems.map(i => i.id);

        return await db.$transaction(async (tx) => {
            // 2. Get existing STUDIO_REFERENCE Media for this Clip + Type
            // We identify type by checking the linked StudioItem's type
            const existingMedia = await tx.media.findMany({
                where: {
                    referenceForClipId: clipId,
                    category: 'STUDIO_REFERENCE',
                    studioItem: {
                        type: type === 'CHARACTER' ? 'LIB_CHARACTER' : 'LIB_LOCATION'
                    }
                },
                include: { studioItem: true }
            });

            const existingItemIds = existingMedia.map(m => m.studioItemId).filter(id => id !== null) as number[];
            const existingIdSet = new Set(existingItemIds);
            const foundIdSet = new Set(foundItemIds);

            // 3. Calc Diff
            const toAdd = foundItemIds.filter(id => !existingIdSet.has(id));
            const toRemove = existingMedia.filter(m => m.studioItemId && !foundIdSet.has(m.studioItemId));

            if (toAdd.length === 0 && toRemove.length === 0) return;

            console.log(`[MediaService] Sync ${type} for Clip ${clipId}: +${toAdd.length} / -${toRemove.length}`);

            // 4. Remove
            if (toRemove.length > 0) {
                await tx.media.deleteMany({
                    where: { id: { in: toRemove.map(m => m.id) } }
                });
            }

            // 5. Add
            if (toAdd.length > 0) {
                // Determine Sort Order
                // Location = 100
                // Characters = 90 - index (to preserve order if possible, though 'names' order matters)
                // We'll just use fixed buckets for now. 
                // Phase 2 logic: "Location gets highest, then chars"

                for (const itemId of toAdd) {
                    const item = studioItems.find(i => i.id === itemId);
                    if (!item) continue;

                    // Parse item URL (CSV support)
                    const itemUrls = parseStringList(item.refImageUrl || '');
                    const primaryUrl = itemUrls[0] || '';

                    // Sort Logic
                    let sortOrder = 0;
                    if (type === 'LOCATION') sortOrder = 100;
                    if (type === 'CHARACTER') {
                        // Find index in input array to preserve order
                        const index = validNames.findIndex(n => n === item.name);
                        sortOrder = 90 - index; // 90, 89, 88...
                    }

                    await tx.media.create({
                        data: {
                            url: primaryUrl, // Snapshot current URL (will be enriched on read)
                            type: 'IMAGE',
                            category: 'STUDIO_REFERENCE',
                            referenceForClipId: clipId,
                            episodeId: (await tx.clip.findUnique({ where: { id: clipId }, select: { episodeId: true } }))?.episodeId,
                            studioItemId: itemId,
                            refImageSort: sortOrder
                        }
                    });
                }
            }
        });
    }
}
