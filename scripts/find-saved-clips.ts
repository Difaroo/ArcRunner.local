import { db } from '@/lib/db';

async function verify() {
    console.log('--- Finding "Saved" Clips ---');

    const clips = await db.clip.findMany({
        where: { status: { contains: 'Saved' } }, // Loose match
        select: { id: true, episodeId: true, resultUrl: true }
    });

    console.log(`Found ${clips.length} Saved clips.`);
    clips.forEach(c => {
        console.log(`[${c.id}] Ep ${c.episodeId}: ${c.resultUrl ? c.resultUrl.substring(0, 50) + '...' : 'NULL'}`);
    });
}

verify();
