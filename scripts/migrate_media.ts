import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
    console.log('Starting Media Migration...');

    // 1. Migrate Clips (Results)
    const clips = await prisma.clip.findMany({
        where: { NOT: { resultUrl: null } }
    });

    let resultCount = 0;
    for (const clip of clips) {
        if (!clip.resultUrl) continue;
        const urls = clip.resultUrl.split(',').map(u => u.trim()).filter(Boolean);

        for (const url of urls) {
            // Check existence
            const exists = await prisma.media.findFirst({
                where: { url: url, resultForClipId: clip.id }
            });

            if (!exists) {
                await prisma.media.create({
                    data: {
                        url,
                        type: url.endsWith('.mp4') ? 'VIDEO' : 'IMAGE',
                        category: 'RESULT',
                        resultForClipId: clip.id,
                        localPath: url.startsWith('/') ? url : undefined
                    }
                });
                resultCount++;
            }
        }
    }
    console.log(`Migrated ${resultCount} Clip Results.`);

    // 2. Migrate Studio Items
    const items = await prisma.studioItem.findMany({
        where: { NOT: { refImageUrl: null } }
    });

    let studioCount = 0;
    for (const item of items) {
        if (!item.refImageUrl) continue;
        const urls = item.refImageUrl.split(',').map(u => u.trim()).filter(Boolean);

        for (const url of urls) {
            // Check existence
            const exists = await prisma.media.findFirst({
                where: { url: url, studioItemId: item.id }
            });

            if (!exists) {
                await prisma.media.create({
                    data: {
                        url,
                        type: 'IMAGE',
                        category: 'REFERENCE',
                        studioItemId: item.id,
                        localPath: url.startsWith('/') ? url : undefined
                    }
                });
                studioCount++;
            }
        }
    }
    console.log(`Migrated ${studioCount} Studio Assets.`);
    console.log('Migration Complete.');
}

migrate()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
