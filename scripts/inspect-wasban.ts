
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Inspecting "Wasban" ---');

    // 1. Find Studio Item
    const items = await prisma.studioItem.findMany({
        where: {
            name: { contains: 'Wasban' }
        }
    });
    console.log('Studio Items Found:', items.length);
    items.forEach(item => {
        console.log(`- ID: ${item.id}, Name: "${item.name}", SeriesID: ${item.seriesId}, Ref: ${item.refImageUrl ? 'YES' : 'NO'}`);
    });

    // 2. Find Series
    if (items.length > 0) {
        const seriesIds = [...new Set(items.map(i => i.seriesId))];
        const seriesList = await prisma.series.findMany({
            where: { id: { in: seriesIds } }
        });
        console.log('Series contexts:', seriesList.map(s => `${s.name} (${s.id})`));
    }

    // 3. Find Episode 3 of Series 5 (Assuming Series 5 is the name or ID?)
    // Let's list all episodes that might be valid.
    const episodes = await prisma.episode.findMany({
        where: {
            number: 3
        },
        include: {
            series: true
        }
    });

    console.log('--- Episodes matching #3 ---');
    episodes.forEach(e => {
        console.log(`- Ep 3 in Series "${e.series.name}" (${e.seriesId}). UUID: ${e.id}`);
    });

    // 4. Check Clips using Wasban
    const clips = await prisma.clip.findMany({
        where: {
            character: { contains: 'Wasban' }
        },
        include: {
            episode: {
                include: { series: true }
            }
        }
    });

    console.log('--- Clips using "Wasban" ---');
    clips.forEach(c => {
        console.log(`- Clip ${c.id} (Scene ${c.scene}) in Series "${c.episode.series.name}". Character raw: "${c.character}"`);
    });

}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
