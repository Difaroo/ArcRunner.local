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
        const { url, targetClipId, sourceClipId } = body;

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
                // FIX: Must also match URL to avoid picking old history items!
                // We use findFirst but constrain by URL.
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

            // Sync CSV
            const addUrlToCsv = (current: string | null, urlToAdd: string) => {
                const list = (current || '').split(',').map(s => s.trim()).filter(Boolean);
                if (!list.includes(urlToAdd)) {
                    return [...list, urlToAdd].join(',');
                }
                return current || '';
            };

            await db.clip.update({
                where: { id: clipId },
                data: {
                    refImageUrls: addUrlToCsv(targetClip.refImageUrls, url)
                }
            });
            if (sourceClipId) {
                const srcClipId = parseInt(sourceClipId, 10);
                if (!isNaN(srcClipId)) {
                    const srcClip = await db.clip.findUnique({ where: { id: srcClipId } });
                    // Normalize check for resultURL match
                    // We import normalizeUrl helper inline or duplicate safely?
                    // We'll trust exact match for now as resultUrl usually comes from same system.
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
                action: 'moved', // Report as move since we cleared source
                mediaId: newMedia.id,
                clipId: clipId
            });
        }

        // FIX: User requested "Change of Relationship" (Move), not Copy.
        // We revert to MOVE logic, but keep the strict URL check to ensure we target the correct image.

        // Check if ALREADY exists as a REFERENCE for this clip
        if (existingMedia.referenceForClipId === clipId) {
            return NextResponse.json(
                { error: 'This image is already a reference for this clip' },
                { status: 409 }
            );
        }

        // MOVE: Update existing record - set as reference, clear result association
        const updatedMedia = await db.media.update({
            where: { id: existingMedia.id },
            data: {
                referenceForClipId: clipId,
                resultForClipId: null, // Clear result association - it's now a reference
                category: 'REFERENCE',
                episodeId: targetClip.episodeId
            }
        });

        // CRITICAL: Update Sync - Add URL to Clip.refImageUrls
        // This ensures the frontend grid (which reads these legacy fields) updates immediately.
        const addUrlToCsv = (current: string | null, urlToAdd: string) => {
            const list = (current || '').split(',').map(s => s.trim()).filter(Boolean);
            if (!list.includes(urlToAdd)) {
                return [...list, urlToAdd].join(',');
            }
            return current || '';
        };

        const nextRefs = addUrlToCsv(targetClip.refImageUrls, url);

        if (nextRefs !== targetClip.refImageUrls) {
            await db.clip.update({
                where: { id: clipId },
                data: {
                    refImageUrls: nextRefs
                }
            });
            console.log(`[AddRef] Synced CSV fields for Clip ${clipId}`);
        }

        // CRITICAL: If this was previously a RESULT, update the OLD clip to clear legacy fields
        // This prevents "ghost" thumbnails where the clip still thinks it has a result.
        if (existingMedia.resultForClipId) {
            console.log(`[AddRef] Clearing legacy result fields for Clip ${existingMedia.resultForClipId}`);
            await db.clip.update({
                where: { id: existingMedia.resultForClipId },
                data: {
                    resultUrl: '',
                    thumbnailPath: '',
                    taskId: '',
                    status: 'Ready'
                }
            });
        }

        console.log(`[AddRef] Moved Media ${updatedMedia.id}: resultForClipId=${existingMedia.resultForClipId} -> referenceForClipId=${clipId}`);

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

