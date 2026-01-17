import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/media/copy-ref
 * 
 * COPIES an image URL as a new Media record linked to a target clip as a reference.
 * Creates a duplicate (unlike move which reassigns).
 * 
 * Body: { url: string, targetClipId: string }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url, targetClipId } = body;

        if (!url || !targetClipId) {
            return NextResponse.json(
                { error: 'Missing required fields: url and targetClipId' },
                { status: 400 }
            );
        }

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

        // Check if this exact URL is already a reference for this clip
        const existingRef = await db.media.findFirst({
            where: {
                url: url,
                referenceForClipId: clipId
            }
        });

        if (existingRef) {
            return NextResponse.json(
                { error: 'This image is already a reference for this clip' },
                { status: 409 }
            );
        }

        // Create new Media record as reference for target clip (COPY - creates duplicate)
        const newMedia = await db.media.create({
            data: {
                url: url,
                type: 'IMAGE',
                category: 'REFERENCE',
                referenceForClipId: clipId
            }
        });

        console.log(`[CopyRef] Created Media ${newMedia.id} copying ${url} → Clip ${clipId}`);

        return NextResponse.json({
            success: true,
            action: 'copied',
            mediaId: newMedia.id,
            clipId: clipId
        });

    } catch (error: any) {
        console.error('[CopyRef] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to copy reference' },
            { status: 500 }
        );
    }
}
