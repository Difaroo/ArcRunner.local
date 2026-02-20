
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const episodeUuid = '088f7570-1797-4f31-92e4-13ca7c67b39a'; // Correct UUID
    console.log(`Checking DB for Episode UUID: ${episodeUuid}`);

    // 1. Check Episode
    const episode = await prisma.episode.findUnique({
        where: { id: episodeUuid },
        include: { series: true }
    });
    console.log('Episode:', episode ? `Found: ${episode.title}` : 'Not Found');
    if (!episode) return;

    // 2. Check Media
    const media = await prisma.media.findMany({
        where: { episodeId: episodeUuid }
    });
    console.log(`Found ${media.length} Media records for Episode ${episodeUuid}`);
    media.forEach((m: any) => {
        console.log(`- Media ID: ${m.id}, Type: ${m.type}, Category: ${m.category}, local: ${m.localPath}, url: ${m.url}, thumbnail: ${m.thumbnailPath}, sort: ${m.refImageSort}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
