import { db } from '@/lib/db';

async function verify() {
    console.log('--- Inspecting Series 1 Ep 2 Clips ---');

    const ep2Id = 'b913619c-ecae-4e3e-acba-b7e7e31ae9bc';

    const clips = await db.clip.findMany({
        where: { episodeId: ep2Id },
        select: { id: true, status: true, resultUrl: true, taskId: true }
    });

    console.log(`Found ${clips.length} clips.`);
    clips.forEach(c => {
        console.log(`[${c.id}] Status: ${c.status} | URL: ${c.resultUrl ? c.resultUrl.substring(0, 60) + '...' : 'NULL'} | Task: ${c.taskId}`);
    });
}

verify();
