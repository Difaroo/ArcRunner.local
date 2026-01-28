import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/media/unlink
 * 
 * Detaches a Media item from its parent Clip.
 * Handles both References (referenceForClipId) and Results (resultForClipId).
 */
export async function POST(req: NextRequest) {
    try {
        const { url, clipId, isResult } = await req.json();

        console.log(`[Unlink] Request: url=${url?.substring(0, 50)}... clipId=${clipId} isResult=${isResult}`);

        if (!url) {
            return NextResponse.json({ error: 'URL required' }, { status: 400 });
        }

        const clipIdNum = clipId ? parseInt(clipId) : undefined;

        // Strategy: First try exact URL match, then try clipId-only match for results
        let media = null;

        // 1. Try exact match (URL + clipId + type)
        if (clipIdNum) {
            const whereExact: any = { url: url };
            if (isResult) {
                whereExact.resultForClipId = clipIdNum;
            } else {
                whereExact.referenceForClipId = clipIdNum;
            }

            media = await db.media.findFirst({ where: whereExact });
            console.log(`[Unlink] Exact match result: ${media ? 'FOUND' : 'NOT FOUND'}`);
        }

        // 2. If result and not found by exact URL, try finding ANY result for this clip
        // (handles URL mismatch between proxy vs stored path)
        if (!media && isResult && clipIdNum) {
            console.log(`[Unlink] Trying to find any result for clipId=${clipIdNum}...`);
            const allResults = await db.media.findMany({
                where: { resultForClipId: clipIdNum },
                orderBy: { createdAt: 'desc' }
            });
            console.log(`[Unlink] Found ${allResults.length} results for clipId=${clipIdNum}`);

            // Find the one matching our URL (normalized)
            const targetUrl = url.replace(/^.*\/media\//, '/media/');
            media = allResults.find(m => m.url.includes(targetUrl) || targetUrl.includes(m.url));

            if (!media && allResults.length > 0) {
                // Last resort: Take the most recent one
                media = allResults[0];
                console.log(`[Unlink] Using most recent result: ${media.url.substring(0, 50)}...`);
            }
        }

        if (!media) {
            console.log(`[Unlink] No Media record found for URL: ${url.substring(0, 50)}...`);
            return NextResponse.json({ success: true, message: 'No Media record found' });
        }

        // 2. Update Media record: Clear the appropriate clip relation
        // episodeId is NOT cleared - media stays in episode!
        const updateData: any = {
            category: 'Unsorted'
        };

        if (isResult) {
            updateData.resultForClipId = null;
            console.log(`[Unlink] Detaching RESULT Media ${media.id} from Clip ${media.resultForClipId || clipIdNum}`);

            // CRITICAL: Update the Clip to clear legacy fields.
            // FALCON FIX: Use the requested clipId (if available) as the primary target 
            // to ensure we clear the specific clip user interacted with, 
            // even if the Media record was already partially detached/orphaned.
            const targetClipId = media.resultForClipId || clipIdNum;

            if (targetClipId) {
                await db.clip.update({
                    where: { id: targetClipId },
                    data: {
                        resultUrl: '',
                        thumbnailPath: '',
                        taskId: '', // Clear task ID
                        status: 'Ready' // Reset status
                    }
                });
                console.log(`[Unlink] Cleared Clip ${targetClipId} fields (thumbnail, result, status)`);
            }

        } else {
            updateData.referenceForClipId = null;
            console.log(`[Unlink] Detaching REFERENCE Media ${media.id} from Clip ${media.referenceForClipId}`);
        }

        await db.media.update({
            where: { id: media.id },
            data: updateData
        });

        return NextResponse.json({ success: true, mediaId: media.id });

    } catch (e: any) {
        console.error('[Unlink] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

