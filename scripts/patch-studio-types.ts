
// @ts-nocheck
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Patching Studio Item Types...');

    const items = await prisma.studioItem.findMany({
        where: { type: 'LIB_OTHER' }
    });

    const updates = [];

    for (const item of items) {
        let newType = 'LIB_OTHER';
        const name = item.name.toLowerCase();

        // Heuristics
        if (
            name.includes('candy') ||
            name.includes('chet') ||
            name.includes('jack') ||
            name.includes('fritz') ||
            name.includes('arlene') ||
            name.includes('john') ||
            name.includes('gilbert') ||
            name.includes('character') ||
            name.includes('people') ||
            name.includes('handler') ||
            name.includes('police') ||
            name.includes('wife') ||
            name.includes('albino') ||
            name.includes('hacker') ||
            name.includes('believer') ||
            name.includes('team') ||
            name.includes('farmhand')
        ) {
            newType = 'LIB_CHARACTER';
        } else if (
            name.includes('studio') ||
            name.includes('shed') ||
            name.includes('backyard') ||
            name.includes('newsroom') ||
            name.includes('palace') ||
            name.includes('bedroom') ||
            name.includes('lab') ||
            name.includes('street') ||
            name.includes('pasture') ||
            name.includes('corridor') ||
            name.includes('field') ||
            name.includes('basement') ||
            name.includes('van') ||
            name.includes('cafe') ||
            name.includes('desert') ||
            name.includes('porsche') ||
            name.includes('gate')
        ) {
            newType = 'LIB_LOCATION';
        } else if (
            name.includes('noir') ||
            name.includes('style') ||
            name.includes('abstract') ||
            name.includes('surreal') ||
            name.includes('horror') ||
            name.includes('cinematic') ||
            name.includes('documentary') ||
            name.includes('thriller') ||
            name.includes('montage') ||
            name.includes('period') ||
            name.includes('collage') ||
            name.includes('anime')
        ) {
            newType = 'LIB_STYLE';
        } else if (
            name.includes('closeup') ||
            name.includes('close_up') ||
            name.includes('zoom') ||
            name.includes('wide') ||
            name.includes('medium') ||
            name.includes('shot') ||
            name.includes('angle') ||
            name.includes('tracking') ||
            name.includes('insert') ||
            name.includes('drone') ||
            name.includes('portrait') ||
            name.includes('reveal')
        ) {
            newType = 'LIB_CAMERA';
        }

        if (newType !== 'LIB_OTHER') {
            updates.push(prisma.studioItem.update({
                where: { id: item.id },
                data: { type: newType }
            }));
            console.log(`Marking ${item.name} as ${newType}`);
        }
    }

    console.log(`Applying ${updates.length} updates...`);
    await prisma.$transaction(updates);
    console.log('Done!');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
