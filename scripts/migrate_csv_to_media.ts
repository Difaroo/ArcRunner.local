
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function migrate() {
    console.log('Starting Migration: CSV -> Media Table...');

    // 1. Migrate Clips
    const clips = await db.clip.findMany();
    console.log(`Found ${clips.length} Clips.`);

    let resultCount = 0;
    let refCount = 0;

    for (const clip of clips) {
        // A. Migrate Results
        if (clip.resultUrl) {
            const urls = clip.resultUrl.split(',').map(s => s.trim()).filter(Boolean);
            for (const url of urls) {
                // Check exist
                const exists = await db.media.findFirst({
                    where: {
                        resultForClipId: clip.id,
                        url: url,
                        category: 'RESULT'
                    }
                });

                if (!exists) {
                    await db.media.create({
                        data: {
                            url,
                            type: url.endsWith('.mp4') ? 'VIDEO' : 'IMAGE',
                            category: 'RESULT',
                            resultForClipId: clip.id,
                            createdAt: new Date() // Timestamp will be now, unavoidable
                        }
                    });
                    resultCount++;
                }
            }
        }

        // B. Migrate References
        // Use 'refImageUrls' (Legacy Source of Truth)
        if (clip.refImageUrls) {
            const urls = clip.refImageUrls.split(',').map(s => s.trim()).filter(Boolean);
            for (const url of urls) {
                const exists = await db.media.findFirst({
                    where: {
                        referenceForClipId: clip.id,
                        url: url,
                        category: 'REFERENCE'
                    }
                });

                if (!exists) {
                    await db.media.create({
                        data: {
                            url,
                            type: 'IMAGE', // Refs are usually images
                            category: 'REFERENCE',
                            referenceForClipId: clip.id
                        }
                    });
                    refCount++;
                }
            }
        }
    }

    // 2. Migrate Studio Items
    const items = await db.studioItem.findMany();
    console.log(`Found ${items.length} Studio Items.`);
    let studioCount = 0;

    for (const item of items) {
        if (item.refImageUrl) {
            const urls = item.refImageUrl.split(',').map(s => s.trim()).filter(Boolean);
            children: for (const url of urls) {
                const exists = await db.media.findFirst({
                    where: {
                        studioItemId: item.id,
                        url: url,
                        category: 'STUDIO_UPLOAD'
                    }
                });

                if (!exists) {
                    await db.media.create({
                        data: {
                            url,
                            type: 'IMAGE',
                            category: 'STUDIO_UPLOAD',
                            studioItemId: item.id
                        }
                    });
                    studioCount++;
                }
            }
        }
    }

    console.log('--- Migration Complete ---');
    console.log(`Created ${resultCount} Result Media records.`);
    console.log(`Created ${refCount} Reference Media records.`);
    console.log(`Created ${studioCount} Studio Media records.`);
}

migrate()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
