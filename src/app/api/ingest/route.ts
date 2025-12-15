import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { json, episodeId, seriesId, defaultModel } = await request.json();

        if (!json || !episodeId || !seriesId) {
            return NextResponse.json({ error: 'Missing json, episodeId, or seriesId' }, { status: 400 });
        }

        let payload;
        try {
            payload = JSON.parse(json);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
        }

        const clips = Array.isArray(payload) ? payload : (payload.clips || []);
        const library = Array.isArray(payload) ? [] : (payload.library || []);

        console.log(`Ingest (DB Mode): ${clips.length} clips, ${library.length} lib items.`);

        // 1. Verify/Create Episode
        const epNum = parseInt(episodeId);
        if (isNaN(epNum)) {
            return NextResponse.json({ error: 'Invalid Episode ID (Number)' }, { status: 400 });
        }

        // Verify Series matches
        const series = await db.series.findUnique({
            where: { id: seriesId }
        });

        if (!series) {
            return NextResponse.json({ error: `Series not found: ${seriesId}` }, { status: 404 });
        }

        // Find or Create Episode
        let episode = await db.episode.findFirst({
            where: {
                seriesId: series.id,
                number: epNum
            }
        });

        if (!episode) {
            console.log(`Creating Episode ${epNum} for Series ${series.name}`);
            episode = await db.episode.create({
                data: {
                    seriesId: series.id,
                    number: epNum,
                    title: `Episode ${epNum}`,
                    model: defaultModel || ''
                }
            });
        }

        const reports: string[] = [];

        // 2. Process Clips
        const clipPromises = clips.map((clip: any, index: number) => {
            return db.clip.create({
                data: {
                    episodeId: episode!.id,
                    status: clip.status || clip['Status'] || 'Pending',
                    scene: clip.scene || clip['Scene #'] || '',
                    title: clip.title || clip['Title'] || '',
                    character: clip.character || clip['Characters'] || '',
                    location: clip.location || clip['Location'] || '',
                    style: clip.style || clip['Style'] || '',
                    camera: clip.camera || clip['Camera'] || '',
                    action: clip.action || clip['Action'] || '',
                    dialog: clip.dialog || clip['Dialog'] || '',
                    refImageUrls: clip.refImageUrls || clip['Ref Image URLs'] || '',
                    // refVideoUrl: clip.refVideoUrl || '', // Not in schema yet? Add if needed. schema has refImageUrls.
                    seed: clip.seed || clip['Seed'] || '',
                    // duration: ... schema?
                    model: clip.model || defaultModel || '',
                    sortOrder: index + 1 // Start at 1 or use index
                }
            });
        });

        if (clipPromises.length > 0) {
            await Promise.all(clipPromises);
            reports.push(`Clips: ${clips.length} imported.`);
        }

        // 3. Process Library
        const libPromises = library.map((item: any) => {
            return db.studioItem.create({
                data: {
                    seriesId: series.id,
                    type: item.type || 'LIB_UNKNOWN',
                    name: item.name || 'Untitled',
                    description: item.description || item.prompt || '',
                    refImageUrl: item.refImageUrl || '',
                    negatives: item.negatives || '',
                    notes: item.notes || '',
                    episode: episodeId.toString() // Store as string "1" for now
                }
            });
        });

        if (libPromises.length > 0) {
            await Promise.all(libPromises);
            reports.push(`Library: ${library.length} imported.`);
        }

        return NextResponse.json({
            success: true,
            clipsCount: clips.length,
            libraryCount: library.length,
            reports
        });

    } catch (error: any) {
        console.error('Ingest Error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

