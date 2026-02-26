import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeUrl } from "@/lib/utils";

/**
 * POST /api/media/add-ref
 * 
 * MOVES an image to be a reference for a target clip.
 * 
 * For result images (stored on Clip.resultUrl): Creates Media record and clears source clip's resultUrl.
 * For existing Media records: Updates the media's referenceForClipId.
 * 
 * Body: { url: string, targetClipId: string, sourceClipId?: string }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url, targetClipId, sourceClipId, action } = body; // Added 'action' param

        if (!url || !targetClipId) {
            return NextResponse.json(
                { error: 'Missing required fields: url and targetClipId' },
                { status: 400 }
            );
        }

        // Parse clipId - could be string or number
        const clipId = parseInt(targetClipId, 10);
        if (isNaN(clipId)) {
            return NextResponse.json(
                { error: 'Invalid targetClipId - must be numeric' },
                { status: 400 }
            );
        }

        // Verify target clip exists
        const targetClip = await db.clip.findUnique({
            where: { id: clipId }
        });

        if (!targetClip) {
            return NextResponse.json(
                { error: `Clip not found: ${clipId}` },
                { status: 404 }
            );
        }

        // 1. Try to find Media by RELATIONSHIP (If this is a Move operation from a known source clip)
        // This is robust against URL string variations (e.g. encoded/decoded differences)
        let existingMedia = null;
        if (sourceClipId) {
            const srcId = parseInt(sourceClipId, 10);
            if (!isNaN(srcId)) {
                existingMedia = await db.media.findFirst({
                    where: {
                        resultForClipId: srcId,
                        url: url
                    }
                });
            }
        }

        // 2. Fallback: Find by URL (Normalized) if relationship lookup failed or wasn't applicable
        if (!existingMedia) {
            // Try exact match first (Performance)
            existingMedia = await db.media.findFirst({
                where: { url: url }
            });
        }

        // 3. Deep Fallback: If URL has query params differences, we might want to check normalized?
        // (Skipped for now to avoid over-engineering unless user issue persists, as Relationship check solves the primary "Sideload" case)

        if (!existingMedia) {
            // No existing Media - this is likely a result image stored on Clip.resultUrl
            // Create new Media record as reference with episodeId
            // Detect type based on extension
            const isVideo = url.match(/\.(mp4|mov|webm|mkv)($|\?)/i);
            const mediaType = isVideo ? 'VIDEO' : 'IMAGE';

            const newMedia = await db.media.create({
                data: {
                    url: url,
                    type: mediaType,
                    category: 'REFERENCE',
                    referenceForClipId: clipId,
                    episodeId: targetClip.episodeId  // Direct episode ownership
                }
            });

            // BRIDGE: Also create ModelInputSlot (Relational Architecture v0.28+)
            const maxSlot = await db.modelInputSlot.aggregate({
                where: { clipId },
                _max: { sortOrder: true }
            });
            await db.modelInputSlot.create({
                data: {
                    clipId,
                    mediaId: newMedia.id,
                    sortOrder: (maxSlot._max.sortOrder ?? -1) + 1
                }
            });
            console.log(`[AddRef] Created ModelInputSlot for Media ${newMedia.id} → Clip ${clipId}`);

            if (sourceClipId) {
                const srcClipId = parseInt(sourceClipId, 10);
                if (!isNaN(srcClipId)) {
                    const srcClip = await db.clip.findUnique({ where: { id: srcClipId } });
                    if (srcClip && srcClip.resultUrl === url) {
                        await db.clip.update({
                            where: { id: srcClipId },
                            data: { resultUrl: null, thumbnailPath: null }
                        });
                        console.log(`[AddRef] Cleared resultUrl from Clip ${srcClipId}`);
                    }
                }
            }

            console.log(`[AddRef] Created Media ${newMedia.id} for ${url} → Clip ${clipId}`);
            return NextResponse.json({
                success: true,
                action: 'moved',
                mediaId: newMedia.id,
                clipId: clipId
            });
        }

        // 4. Move or Copy Logic
        const isSameClipResult = existingMedia.resultForClipId === clipId;
        const isOrphan = !existingMedia.referenceForClipId && !existingMedia.resultForClipId;
        const isExplicitMove = action === 'move';
        const shouldMove = isSameClipResult || isOrphan || isExplicitMove;

        if (!shouldMove) {
            // COPY
            console.log(`[AddRef] COPY strategy: Duplicating Media ${existingMedia.id}`);
            const newMedia = await db.media.create({
                data: {
                    url: existingMedia.url,
                    localPath: existingMedia.localPath,
                    type: existingMedia.type,
                    mimeType: existingMedia.mimeType,
                    size: existingMedia.size,
                    width: existingMedia.width,
                    height: existingMedia.height,
                    category: 'REFERENCE',
                    referenceForClipId: clipId,
                    episodeId: targetClip.episodeId
                }
            });

            // BRIDGE: Also create ModelInputSlot
            const maxSlotCopy = await db.modelInputSlot.aggregate({
                where: { clipId },
                _max: { sortOrder: true }
            });
            await db.modelInputSlot.create({
                data: {
                    clipId,
                    mediaId: newMedia.id,
                    sortOrder: (maxSlotCopy._max.sortOrder ?? -1) + 1
                }
            });
            console.log(`[AddRef] Created ModelInputSlot for copied Media ${newMedia.id} → Clip ${clipId}`);

            return NextResponse.json({ success: true, action: 'copied', mediaId: newMedia.id, clipId: clipId });
        }

        // MOVE
        const updatedMedia = await db.media.update({
            where: { id: existingMedia.id },
            data: {
                referenceForClipId: clipId,
                resultForClipId: null,
                category: 'REFERENCE',
                episodeId: targetClip.episodeId
            }
        });

        // BRIDGE: Also create ModelInputSlot for the moved media
        const maxSlotMove = await db.modelInputSlot.aggregate({
            where: { clipId },
            _max: { sortOrder: true }
        });
        await db.modelInputSlot.create({
            data: {
                clipId,
                mediaId: updatedMedia.id,
                sortOrder: (maxSlotMove._max.sortOrder ?? -1) + 1
            }
        });
        console.log(`[AddRef] Created ModelInputSlot for moved Media ${updatedMedia.id} → Clip ${clipId}`);

        // Clear legacy result fields on old owner
        if (existingMedia.resultForClipId) {
            await db.clip.update({
                where: { id: existingMedia.resultForClipId },
                data: { resultUrl: '', thumbnailPath: '', taskId: '', status: 'Ready' }
            });
        }

        return NextResponse.json({
            success: true,
            action: 'moved',
            mediaId: updatedMedia.id,
            previousResultClipId: existingMedia.resultForClipId,
            newReferenceForClipId: clipId
        });

    } catch (error: any) {
        console.error('[AddRef] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to add reference' },
            { status: 500 }
        );
    }
}

// Helper to avoid import issues
function parseStringList(val: string | null | undefined): string[] {
    if (!val) return [];
    return val.split(',').map(s => s.trim()).filter(Boolean);
}
function joinStringList(list: string[]): string {
    return list.join(',');
}
