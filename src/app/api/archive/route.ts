import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { downloadAndSave } from '@/lib/storage';

export async function POST(req: Request) {
    try {
        const { url, id, type } = await req.json();

        if (!url || !id) {
            return NextResponse.json({ error: 'Missing url or id' }, { status: 400 });
        }

        console.log(`[Archive] Request to archive ${url} for ID ${id} (${type})`);

        const numericId = parseInt(id);
        if (isNaN(numericId)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        let filename = `Archive_${id}`;

        if (type === 'library') {
            const item = await db.studioItem.findUnique({ where: { id: numericId } });
            if (!item) return NextResponse.json({ error: 'Library Item not found' }, { status: 404 });

            filename = item.name ? `${item.name} (${item.type})` : `Library_${id}`;

            // Download & Save
            const localUrl = await downloadAndSave(url, filename, 'generated');
            if (!localUrl) return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });

            // Update DB
            await db.studioItem.update({
                where: { id: numericId },
                data: { refImageUrl: localUrl }
            });

            return NextResponse.json({ success: true, url: localUrl });
        } else {
            // Clip
            const clip = await db.clip.findUnique({ where: { id: numericId } });
            if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 });

            // Construct Filename: Scene Title [ver]
            const scene = clip.scene || '0';
            const title = clip.title || 'Untitled';
            const status = clip.status || ''; // e.g. "Saved [1]"

            // Calculate Version
            let ver = 1;
            if (status.startsWith('Saved')) {
                const match = status.match(/Saved \[(\d+)\]/);
                if (match) {
                    ver = parseInt(match[1]);
                } else if (status === 'Saved') {
                    ver = 1;
                }
            }

            // Clean Title
            const safeTitle = title.replace(/[^a-zA-Z0-9 ]/gi, '');
            const safeScene = scene.replace(/[^0-9.]/g, '');

            filename = `${safeScene} ${safeTitle}`;
            if (ver > 1) {
                filename += ` ${ver.toString().padStart(2, '0')}`;
            }

            // Download & Save
            const localUrl = await downloadAndSave(url, filename, 'generated');
            if (!localUrl) return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });

            // Update DB
            await db.clip.update({
                where: { id: numericId },
                data: { resultUrl: localUrl }
            });

            return NextResponse.json({ success: true, url: localUrl });
        }

    } catch (error: any) {
        console.error('Archive error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

