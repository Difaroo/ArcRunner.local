import { db } from '@/lib/db';

async function verify() {
    console.log('--- Inspecting Recent Clips ---');

    const clips = await db.clip.findMany({
        orderBy: { id: 'desc' },
        take: 5,
        select: { id: true, status: true, resultUrl: true }
    });

    console.log(`Found ${clips.length} recent clips.`);
    clips.forEach(c => {
        console.log(`[${c.id}] Status: ${c.status} | URL: ${c.resultUrl}`);
    });
}

verify();
