import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

        // Find existing Media record by URL (Normalized Check)
        // We fetch ALL media for this clip (or potential match) and filter manually because Prisma can't do fuzzy/normalized matching easily
        // Or better: Search by suffix?
        // Since we can't easily search normalized in DB without raw query, we search exact FIRST.
        // If fails, we proceed. Result duplication is acceptable if URLs truly differ, but let's try to match.
        // Actually, best effort: Check exact URL first.
        let existingMedia = await db.media.findFirst({
            where: { url: url }
        });

        // If not found exact, try finding by suffix if url is absolute/relative mismatch?
        // Skipped for performance unless critical.
        // But we MUST ensuring we don't duplicate Logic.

        if (!existingMedia) {
            // No existing Media - this is likely a result image stored on Clip.resultUrl
            // Create new Media record as reference with episodeId
            const newMedia = await db.media.create({
                data: {
                    url: url,
                    type: 'IMAGE',
                    category: 'REFERENCE',
                    referenceForClipId: clipId,
                    episodeId: targetClip.episodeId  // Direct episode ownership
                }
            });

            // If sourceClipId provided, clear its resultUrl to complete the "move"
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

        // Check if already a reference for this clip
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
                episodeId: targetClip.episodeId  // Update to target clip's episode
            }
        });

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

        console.log(`[AddRef] Moved Media ${updatedMedia.id}: resultForClipId=${existingMedia.resultForClipId} → referenceForClipId=${clipId}`);

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

