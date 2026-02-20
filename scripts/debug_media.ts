
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const episodeId = '2'; // Based on URL in user context
    console.log(`Checking DB for Episode ID: ${episodeId}`);

    // 1. Check Episode
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: { series: true }
    });
    console.log('Episode:', episode ? 'Found' : 'Not Found');
    if (!episode) return;

    // 2. Check Media
    const media = await prisma.media.findMany({
        where: { episodeId: episodeId }
    });
    console.log(`Found ${media.length} Media records for Episode ${episodeId}`);
    media.forEach((m: any) => {
        console.log(`- Media ID: ${m.id}, Type: ${m.type}, Category: ${m.category}, URL: ${m.url ? m.url.substring(0, 50) : 'null'}...`);
    });

    // 3. Check Studio Items for Series
    const studioItems = await prisma.studioItem.findMany({
        where: { seriesId: episode.seriesId }
    });
    console.log(`Found ${studioItems.length} Studio Items for Series ${episode.seriesId}`);
    studioItems.forEach((s: any) => {
        console.log(`- StudioItem ID: ${s.id}, Name: ${s.name}, Type: ${s.type}`);
    });

    // 4. Check Clips
    const clips = await prisma.clip.findMany({
        where: { episodeId: episodeId }
    });
    console.log(`Found ${clips.length} Clips for Episode ${episodeId}`);

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
