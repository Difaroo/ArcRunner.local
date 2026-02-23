import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function run() {
    const seriesId = '2';
    const libraryItems = await db.studioItem.findMany({
        where: { seriesId },
        include: {
            media: true
        }
    });

    console.log(`Library items for series 2:`);
    for (const item of libraryItems) {
        if (item.name === 'Team' || item.name === 'Desert_Night') {
            const anyItem = item as any;
            console.log(`- ${item.name} (${item.type})`);
            console.log(`  refImageUrl: ${item.refImageUrl}`);
            console.log(`  media linked: ${anyItem.media.length}`);
            if (anyItem.media.length > 0) {
                console.log(`  media[0].url: ${anyItem.media[0].url}`);
            }
        }
    }
}

run().catch(console.error).finally(() => db.$disconnect());
