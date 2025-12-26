
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateThumbnail } from '@/lib/thumbnail-generator';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const clip = await db.clip.findUnique({
            where: { id: id }
        });

        if (!clip) {
            return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
        }

        if (!clip.resultUrl) {
            return NextResponse.json({ error: 'Clip has no video URL (resultUrl)' }, { status: 400 });
        }

        // Trigger Generation
        const thumbnailPath = await generateThumbnail(clip.resultUrl, id.toString());

        if (!thumbnailPath) {
            return NextResponse.json({ error: 'Failed to generate thumbnail' }, { status: 500 });
        }

        // Update DB
        await db.clip.update({
            where: { id: id },
            data: { thumbnailPath }
        });

        return NextResponse.json({ success: true, thumbnailPath });

    } catch (error: any) {
        console.error('Thumbnail Generation API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
