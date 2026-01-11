import { db } from '../db';
import { Media } from '@prisma/client';

/**
 * MediaService (The "Falcon" Shim)
 * 
 * Responsible for handling all media operations with "Dual-Write" safety.
 * It writes to BOTH the new `Media` table and the old `Clip` CSV columns
 * to ensure zero-downtime compatibility.
 */
export class MediaService {

    /**
     * Records a new Generation Result (Video/Image) for a Clip.
     * Enforces Double-Lock:
     * 1. Appends to `Clip.resultUrl` (Legacy CSV)
     * 2. Creates `Media` record (New)
     */
    static async addResult(clipId: number, url: string, type: 'VIDEO' | 'IMAGE' = 'VIDEO', localPath?: string) {
        // 1. Get current clip to append to CSV (Legacy)
        const clip = await db.clip.findUnique({ where: { id: clipId }, select: { resultUrl: true } });
        if (!clip) throw new Error(`Clip ${clipId} not found`);

        let newCsv = url;
        if (clip.resultUrl) {
            // Prepend new URL to maintain history order (Newest First)
            newCsv = `${url},${clip.resultUrl}`;
        }

        // 2. Perform Transactional Write
        // We update the Clip CSV and create the Media record in one atomic go.
        return await db.$transaction(async (tx) => {
            // A. Legacy Update (STOPPED - Phase 3)
            // We no longer write to the legacy CSV column.
            /*
            await tx.clip.update({
                where: { id: clipId },
                data: { resultUrl: newCsv }
            });
            */

            // B. New Media Record
            const media = await tx.media.create({
                data: {
                    url: url,
                    type: type,
                    category: 'RESULT',
                    localPath: localPath,
                    resultForClipId: clipId
                }
            });

            return media;
        });
    }

    /**
     * Records a new Explicit Reference Image for a Clip.
     * Enforces Double-Lock.
     */
    static async addReference(clipId: number, url: string) {
        const clip = await db.clip.findUnique({ where: { id: clipId }, select: { refImageUrls: true } });
        if (!clip) throw new Error(`Clip ${clipId} not found`);

        let newCsv = url;
        if (clip.refImageUrls) {
            // Append for references (Order matters less, but usually Append)
            newCsv = `${clip.refImageUrls},${url}`;
        }

        return await db.$transaction(async (tx) => {
            /*
            await tx.clip.update({
                where: { id: clipId },
                data: { refImageUrls: newCsv }
            });
            */

            await tx.media.create({
                data: {
                    url: url,
                    type: 'IMAGE',
                    category: 'REFERENCE',
                    referenceForClipId: clipId
                }
            });
        });
    }

    /**
     * Retrieves all results for a Clip, intelligently merging Legacy CSVs with New Media Table.
     * Shim Strategy:
     * - If Media Table has records, return those.
     * - If Media Table is empty (Legacy Clip), parse the CSV and return "Virtual" Media objects.
     */
    static async getResults(clipId: number): Promise<Media[]> {
        // 1. Try New Table
        const dbResults = await db.media.findMany({
            where: { resultForClipId: clipId, category: 'RESULT' },
            orderBy: { createdAt: 'desc' }
        });

        if (dbResults.length > 0) {
            return dbResults;
        }

        // 2. Fallback to Legacy CSV
        const clip = await db.clip.findUnique({ where: { id: clipId }, select: { resultUrl: true } });
        if (!clip || !clip.resultUrl) return [];

        const urls = clip.resultUrl.split(',').map((u: string) => u.trim()).filter((u: string) => u.length > 0);

        // Map to "Virtual" Media Objects
        // We fake the IDs and Timestamps since they don't exist in the CSV.
        return urls.map((url: string, index: number) => ({
            id: `legacy_res_${clipId}_${index}`,
            url: url,
            type: url.endsWith('.mp4') ? 'VIDEO' : 'IMAGE',
            category: 'RESULT',
            localPath: null,
            mimeType: null,
            size: null,
            width: null,
            height: null,
            createdAt: new Date(), // Unknown date
            referenceForClipId: null,
            resultForClipId: clipId,
            studioItemId: null
        }) as Media);
    }

    /**
     * Synchronizes a CSV list of Reference URLs (from User Edit) with the Media table.
     * Handles Adds and Removes intelligently.
     * Enforces Dual-Write (Updates Legacy CSV + Syncs Media Table).
     */
    static async syncReferences(clipId: number, csvUrls: string) {
        // 1. Parse Input
        const newUrls = csvUrls.split(',').map(u => u.trim()).filter(u => u.length > 0);
        const newUrlSet = new Set(newUrls);

        // 2. Fetch Existing Media References
        const existingMedia = await db.media.findMany({
            where: {
                referenceForClipId: clipId,
                category: 'REFERENCE'
            }
        });

        const existingUrlSet = new Set(existingMedia.map(m => m.url));

        // 3. Determine Deltas
        const toAdd = newUrls.filter(url => !existingUrlSet.has(url));
        const toRemove = existingMedia.filter(m => !newUrlSet.has(m.url));

        console.log(`[MediaService] Sync References for Clip ${clipId}: +${toAdd.length} / -${toRemove.length}`);

        // 4. Perform Transaction
        return await db.$transaction(async (tx) => {
            // A. Update Legacy CSV -> CLEAR IT (Phase 3)
            // We clear the legacy column to ensure readers strictly prefer the Media table
            // and don't fallback to stale data if Media is empty (e.g. user cleared refs).
            await tx.clip.update({
                where: { id: clipId },
                data: { refImageUrls: '' }
            });

            // B. Delete Removed
            if (toRemove.length > 0) {
                await tx.media.deleteMany({
                    where: {
                        id: { in: toRemove.map(m => m.id) }
                    }
                });
            }

            // C. Create Added
            if (toAdd.length > 0) {
                // Bulk create not supported for 'data' array in SQLite with simplistic approach, 
                // but createMany is supported in recent prisma if enabled.
                // Fallback to Promise.all for safety/compatibility.
                for (const url of toAdd) {
                    await tx.media.create({
                        data: {
                            url: url,
                            type: 'IMAGE',
                            category: 'REFERENCE',
                            referenceForClipId: clipId
                        }
                    });
                }
            }
        });
    }

    /**
     * Records a new Result (Image) for a Studio Item (Library).
     * Enforces Double-Lock:
     * 1. Appends to `StudioItem.refImageUrl` (Legacy CSV)
     * 2. Creates `Media` record (New)
     */
    static async addStudioResult(studioItemId: number, url: string, localPath?: string) {
        const item = await db.studioItem.findUnique({ where: { id: studioItemId }, select: { refImageUrl: true } });
        if (!item) throw new Error(`StudioItem ${studioItemId} not found`);

        let newCsv = url;
        if (item.refImageUrl) {
            newCsv = `${url},${item.refImageUrl}`;
        }

        return await db.$transaction(async (tx) => {
            // A. Legacy Update (STOPPED - Phase 3)
            /*
            await tx.studioItem.update({
                where: { id: studioItemId },
                data: { refImageUrl: newCsv }
            });
            */

            const media = await tx.media.create({
                data: {
                    url: url,
                    type: 'IMAGE',
                    category: 'STUDIO_UPLOAD',
                    localPath: localPath,
                    studioItemId: studioItemId
                }
            });

            return media;
        });
    }
}
