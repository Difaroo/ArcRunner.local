
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const seriesId = 'ac28ec95-63ea-47ee-a190-19253dd939b1'; // From user's URL
    console.log('--- Episodes for Series:', seriesId, '---');
    const episodes = await prisma.episode.findMany({
        where: { seriesId },
        select: { id: true, number: true, title: true }
    });
    console.log(episodes);

    console.log('\n--- Media Items ---');
    const media = await prisma.media.findMany({
        take: 10,
        select: { id: true, episodeId: true, url: true }
    });
    console.log(media);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
