import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/media/unlink
 * 
 * Detaches a Media item from its parent Clip.
 * Used when user clicks "-" (Unlink) in the Viewer.
 */
export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'URL required' }, { status: 400 });
        }

        // 1. Find the Media record
        const media = await db.media.findFirst({
            where: { url: url }
        });

        if (!media) {
            // It might exist only as a CSV entry in the Clip (Legacy/Result)
            // In that case, the CSV update in page.tsx handles it.
            // But if we want to be safe, we return success.
            return NextResponse.json({ success: true, message: 'No Media record found, processed as CSV unlink only' });
        }

        // 2. Update Media record: Clear referenceForClipId
        // We DO NOT delete the record, preventing data loss.
        // It becomes an "Orphan" (Unsorted Media).
        await db.media.update({
            where: { id: media.id },
            data: {
                referenceForClipId: null,
                category: 'Unsorted' // Optional: Tag as unsorted
            }
        });

        console.log(`[Unlink] Detached Media ${media.id} from Clip ${media.referenceForClipId}`);

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error('[Unlink] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
