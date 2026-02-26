import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Querying Database for Clip: 1.50.2');
    const clips = await prisma.clip.findMany({
        where: { scene: { contains: '1.50.2' } },
        include: {
            modelInputSlots: {
                include: { media: true, studioItem: true },
                orderBy: { sortOrder: 'asc' }
            }
        }
    });

    if (clips.length === 0) {
        console.log('Clip not found. Dumping all scenes containing "1.50"...');
        const fallback = await prisma.clip.findMany({
            where: { scene: { contains: '1.50' } },
            select: { id: true, scene: true, title: true }
        });
        console.log(fallback);
        return;
    }

    for (const clip of clips) {
        console.log(`\n================================`);
        console.log(`CLIP: ${clip.scene} - ${clip.title}`);
        console.log(`ID: ${clip.id}, Characters: ${clip.character}, Locations: ${clip.location}`);
        console.log(`\n--- MODEL INPUT SLOTS (${clip.modelInputSlots.length}) ---`);
        for (const slot of clip.modelInputSlots) {
            console.log(`- Slot [${slot.sortOrder}] Join ID: ${slot.id}`);
            if (slot.media) {
                console.log(`   └─ MEDIA ID: ${slot.media.id} | TYPE: ${slot.media.category} | URL: ${slot.media.url}`);
            }
            if (slot.studioItem) {
                console.log(`   └─ STUDIO ITEM ID: ${slot.studioItem.id} | NAME: ${slot.studioItem.name} | URL: ${slot.studioItem.refImageUrl}`);
            }
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
