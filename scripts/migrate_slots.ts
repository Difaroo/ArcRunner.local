import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Starting ModelInputSlot Migration...');

    // 1. Migrate explicit refImageSort records
    console.log('📍 Step 1: Migrating explicit Media records with refImageSort > 0...');
    const explicitMedia = await prisma.media.findMany({
        where: {
            refImageSort: { gt: 0 },
            referenceForClipId: { not: null }
        }
    });

    let explicitCount = 0;
    for (const media of explicitMedia) {
        if (!media.referenceForClipId) continue;

        try {
            await prisma.modelInputSlot.upsert({
                where: {
                    clipId_mediaId: {
                        clipId: media.referenceForClipId,
                        mediaId: media.id
                    }
                },
                update: {
                    sortOrder: media.refImageSort
                },
                create: {
                    clipId: media.referenceForClipId,
                    mediaId: media.id,
                    sortOrder: media.refImageSort
                }
            });
            explicitCount++;
        } catch (e) {
            console.error(`Failed to migrate explicit media ${media.id}`, e);
        }
    }
    console.log(`✅ Migrated ${explicitCount} explicit reference slots.`);

    // 2. Migrate implicit Studio Items based on CSV text fields
    console.log('📍 Step 2: Migrating implicit Studio Items from CSV text fields...');

    // We need all clips that have character, location, or style
    const clips = await prisma.clip.findMany({
        where: {
            OR: [
                { character: { not: null, not: '' } },
                { location: { not: null, not: '' } },
                { style: { not: null, not: '' } }
            ]
        }
    });

    // Get all studio media to try and match by name
    const studioMedia = await prisma.media.findMany({
        where: {
            studioItemId: { not: null }
        },
        include: {
            studioItem: true
        }
    });

    let implicitCount = 0;

    for (const clip of clips) {
        const targetStyle = (clip.style || '').trim().toLowerCase();
        const targetLocs = (clip.location || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const targetChars = (clip.character || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

        const matchedMediaIds = new Set<string>();

        for (const sm of studioMedia) {
            if (!sm.studioItem || !sm.studioItem.name) continue;
            const sName = sm.studioItem.name.trim().toLowerCase();

            let matches = false;

            // Match Style
            if (targetStyle && sName === targetStyle && sm.studioItem.type?.includes('STYLE')) {
                matches = true;
            }
            // Match Location
            else if (targetLocs.some(l => sName.includes(l) || l.includes(sName)) && sm.studioItem.type?.includes('LOCATION')) {
                matches = true;
            }
            // Match Character
            else if (targetChars.some(c => sName.includes(c) || c.includes(sName)) && sm.studioItem.type?.includes('CHARACTER')) {
                matches = true;
            }

            if (matches && !matchedMediaIds.has(sm.id)) {
                matchedMediaIds.add(sm.id);
                try {
                    await prisma.modelInputSlot.upsert({
                        where: {
                            clipId_mediaId: {
                                clipId: clip.id,
                                mediaId: sm.id
                            }
                        },
                        update: {
                            // Already exists, maybe explicit. Don't touch sortOrder if we don't need to.
                        },
                        create: {
                            clipId: clip.id,
                            mediaId: sm.id,
                            sortOrder: 0 // Implicit studio items are 0 naturally (base)
                        }
                    });
                    implicitCount++;
                } catch (e) {
                    console.error(`Failed to map implicit studio item ${sm.id} to clip ${clip.id}`, e);
                }
            }
        }
    }

    console.log(`✅ Migrated ${implicitCount} implicit Studio Item structural links.`);
    console.log('🎉 ModelInputSlot Migration Complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
