import { NextRequest, NextResponse } from 'next/server';
import { saveFile } from '@/lib/storage';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        console.log('[Upload API] Received POST request');
        const formData = await request.formData();
        console.log('[Upload API] FormData parsed');
        const file = formData.get('file') as File;
        const clipId = formData.get('clipId') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Clean filename to remove weird chars (but keep dot)
        // Note: storage.ts now handles smart renaming if file exists
        const finalName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

        // Save to local storage (explicitly do not overwrite uploads)
        const url = await saveFile(buffer, finalName, 'upload', { overwrite: false });

        // If clipId is provided, create a Media record so it can be linked to MIS
        let mediaId: string | undefined;
        if (clipId) {
            const clip = await db.clip.findUnique({
                where: { id: parseInt(clipId) },
                select: { episodeId: true }
            });

            if (clip) {
                const media = await db.media.create({
                    data: {
                        url,
                        localPath: url,
                        type: 'IMAGE',
                        category: 'REFERENCE',
                        // Note: NOT setting referenceForClipId — MIS items are linked
                        // via ModelInputSlot.mediaId, not the pool reference relation.
                        episodeId: clip.episodeId
                    }
                });
                mediaId = media.id;
            }
        }

        return NextResponse.json({ url, mediaId });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
