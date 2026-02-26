import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Debugging Clip 325 Data ---');
    const clip = await prisma.clip.findUnique({
        where: { id: 325 },
        include: {
            modelInputSlots: {
                include: { media: true, studioItem: true }
            },
            mediaResults: true
        }
    });

    if (!clip) return console.log('not found');

    console.log(`Title: ${clip.title}`);
    console.log(`Character String: "${clip.character}"`);
    console.log(`Legacy Result URL: "${clip.resultUrl}"`);
    console.log(`Media Results Count: ${clip.mediaResults.length}`);
    if (clip.mediaResults.length > 0) {
        console.log(`Latest Media Result URL: ${clip.mediaResults[clip.mediaResults.length - 1].url}`);
    }

    console.log('\n--- MODEL INPUT SLOTS ---');
    for (const slot of clip.modelInputSlots) {
        console.log(`Slot ${slot.sortOrder}:`);
        if (slot.media) {
            console.log(`  [MEDIA] URL: ${slot.media.url}`);
        } else if (slot.studioItem) {
            console.log(`  [STUDIO ITEM] ID: ${slot.studioItem.id}, Name: ${slot.studioItem.name}, Type: ${slot.studioItem.type}`);
            console.log(`                RefImg: "${slot.studioItem.refImageUrl}"`);
            console.log(`                Thumb:  "${slot.studioItem.thumbnailPath}"`);
        } else {
            console.log('  [EMPTY SLOT]');
        }
    }
}
main().finally(() => prisma.$disconnect());
