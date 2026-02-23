import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function run() {
    const clips = await db.clip.findMany({
        where: {
            title: {
                contains: 'Crash at Roswell'
            }
        },
        include: {
            episode: true,
            mediaReferences: true
        }
    });

    console.log(`Found ${clips.length} clip(s)`);
    for (const clip of clips) {
        console.log({
            id: clip.id,
            title: clip.title,
            scene: clip.scene,
            episodeName: clip.episode?.title,
            character: clip.character,
            location: clip.location,
            style: clip.style,
            mediaReferences: clip.mediaReferences
        });
    }

    // Next let's dump all studio items for the same series
    if (clips.length > 0) {
        const seriesId = clips[0].episode?.seriesId;
        const studioItems = await db.studioItem.findMany({
            where: { seriesId }
        });
        console.log(`\nStudio Items for series ${seriesId}:`);
        for (const item of studioItems) {
            console.log(` - ${item.type}: ${item.name} (${item.id}) [${item.refImageUrl ? 'has url' : 'no url'}]`);
        }
    }
}

run().catch(console.error).finally(() => db.$disconnect());
