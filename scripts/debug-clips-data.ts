// @ts-nocheck
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Data Distribution (Relational)...');

    // 1. Get Series & Episodes
    const seriesList = await prisma.series.findMany({
        include: {
            episodes: true
        }
    });

    console.log('--- Series & Episodes ---');
    for (const series of seriesList) {
        console.log(`Series: ${series.name} (ID: ${series.id})`);
        for (const ep of series.episodes) {
            // Count clips for this episode
            const clipCount = await prisma.clip.count({
                where: { episodeId: ep.id }
            });
            console.log(`  - Ep ${ep.number} "${ep.title}" (ID: ${ep.id}): ${clipCount} Clips`);

            if (clipCount > 0) {
                const sample = await prisma.clip.findFirst({
                    where: { episodeId: ep.id },
                    select: { id: true, title: true, scene: true }
                });
                console.log(`    Sample: [${sample?.id}] Scn ${sample?.scene} - ${sample?.title}`);
            }
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
