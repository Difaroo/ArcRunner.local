
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const episodeId = '088f7570-1797-4f31-92e4-13ca7c67b39a';

    // 1. Get Series ID
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: { seriesId: true }
    });
    const seriesId = episode?.seriesId;
    console.log(`Episode: ${episodeId}, Series: ${seriesId}`);

    // 2. Simulate API Logic
    // Fetch Media
    const media = await prisma.media.findMany({
        where: { episodeId },
        orderBy: { createdAt: 'desc' }
    });
    console.log(`\nEpisode Media: ${media.length} items`);
    media.forEach(m => console.log(`- [MEDIA] ${m.id} | URL: ${m.url.substring(0, 30)}...`));

    // Fetch Studio Items
    const studioItems = await prisma.studioItem.findMany({
        where: {
            seriesId: seriesId,
            OR: [
                { type: 'CHARACTER' },
                { type: 'LOCATION' },
                { type: 'LIB_CHARACTER' },
                { type: 'LIB_LOCATION' }
            ]
        }
    });
    console.log(`\nStudio Items (Raw): ${studioItems.length} items`);

    // Check if these Studio Items have associated Media records?
    const targetIds = [147, 148, 246];
    const studioMedia = await prisma.media.findMany({
        where: {
            studioItemId: { in: targetIds }
        }
    });
    console.log(`\nMedia Records linked to Team/MIB Studio Items: ${studioMedia.length}`);
    studioMedia.forEach(m => console.log(`- Media ${m.id} -> StudioItem ${m.studioItemId} | URL: ${m.url.substring(0, 30)}...`));

    // 3. Simulate Mapping
    const mappedStudio = studioItems.map(item => ({
        id: `studio_item_${item.id}`,
        url: item.refImageUrl || item.thumbnailPath || '',
        category: item.type,
        isStudioItem: true
    }));

    console.log(`\nMapped Studio Items (First 5):`);
    mappedStudio.slice(0, 5).forEach(m => console.log(`- [STUDIO] ${m.id} | URL: '${m.url}'`));

    // Filter for empty URLs causing broken images
    const emptyUrls = mappedStudio.filter(m => !m.url);
    console.log(`\nStudio Items with EMPTY URLs: ${emptyUrls.length}`);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
