
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Debugging Series IDs ---');

    // 1. Find Studio Item "Wasban"
    const wasban = await prisma.studioItem.findFirst({
        where: { name: { contains: 'Wasban' } }
    });
    if (wasban) {
        console.log(`Use Wasban (ID: ${wasban.id}): SeriesID = ${wasban.seriesId}`);
    } else {
        console.log("Wasban NOT FOUND in StudioItem");
    }

    // 2. Find Episodes for Series 5 (Check what "Series 5" really is)
    // We'll look for multiple clips and see their series.
    const clips = await prisma.clip.findMany({
        where: {
            scene: { in: ['2.3', '3.3'] }
        },
        include: {
            episode: {
                include: { series: true }
            }
        }
    });

    clips.forEach(c => {
        console.log(`Clip ${c.id} (Scene ${c.scene}):`);
        console.log(`   - Episode: ${c.episode.number} (ID: ${c.episodeId})`);
        console.log(`   - Series: "${c.episode.series.name}" (ID: ${c.episode.seriesId})`);

        if (wasban) {
            const match = c.episode.seriesId === wasban.seriesId;
            console.log(`   - MATCHES Wasban Series? ${match ? 'YES' : 'NO'}`);
        }
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
