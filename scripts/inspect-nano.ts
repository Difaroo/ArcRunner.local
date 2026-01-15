
import { db } from '../src/lib/db.ts';

async function main() {
    console.log("Inspecting Nano clips...");
    const clips = await db.clip.findMany({
        where: {
            model: { contains: 'nano' },
            status: 'Done'
        },
        take: 10,
        orderBy: { id: 'desc' }
    });

    console.log("Found clips:", JSON.stringify(clips.map(c => ({
        id: c.id,
        resultUrl: c.resultUrl,
        thumbnailPath: c.thumbnailPath
    })), null, 2));
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect());
