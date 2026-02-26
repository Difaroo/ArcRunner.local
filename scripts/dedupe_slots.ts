import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Starting ModelInputSlot Deduplication Script...\n');

    const clips = await prisma.clip.findMany({
        include: {
            modelInputSlots: {
                include: {
                    media: { include: { studioItem: true } },
                    studioItem: true
                },
                orderBy: { sortOrder: 'asc' }
            }
        }
    });

    let totalDeleted = 0;

    for (const clip of clips) {
        if (!clip.modelInputSlots || clip.modelInputSlots.length === 0) continue;

        const seenUrls = new Set<string>();
        const toDelete: string[] = [];
        const toKeep: any[] = [];

        for (const slot of clip.modelInputSlots) {
            // First determine the exact URL this slot represents
            let slotUrl = '';

            if (slot.media) {
                // If it's a standard media record (or linked to a StudioItem)
                slotUrl = slot.media.url;

                // Handle legacy CSV arrays stored in DB (we only care about the first image)
                if (slotUrl && slotUrl.includes(',')) {
                    slotUrl = slotUrl.split(',')[0].trim();
                }
            } else if (slot.studioItem && slot.studioItem.refImageUrl) {
                // If it's pure StudioItem link
                slotUrl = slot.studioItem.refImageUrl;

                if (slotUrl && slotUrl.includes(',')) {
                    slotUrl = slotUrl.split(',')[0].trim();
                }
            }

            // Normalize URL for deduplication
            slotUrl = slotUrl || '';

            if (!slotUrl) {
                // Slot is permanently empty/dead link. Trash it.
                toDelete.push(slot.id);
            } else if (seenUrls.has(slotUrl)) {
                // Exact Duplicate URL found on the same clip! Trash it.
                toDelete.push(slot.id);
            } else {
                // First time seeing this image URL in the sequence. Keep it.
                seenUrls.add(slotUrl);
                toKeep.push(slot);
            }
        }

        // Execute deletions
        if (toDelete.length > 0) {
            await prisma.modelInputSlot.deleteMany({
                where: { id: { in: toDelete } }
            });
            console.log(`🗑️ Deleted ${toDelete.length} duplicate/empty slots from Clip ${clip.scene} (ID: ${clip.id})`);
            totalDeleted += toDelete.length;
        }

        // Repair Sort Orders for remaining slots so there are no structural gaps
        for (let i = 0; i < toKeep.length; i++) {
            if (toKeep[i].sortOrder !== i) {
                await prisma.modelInputSlot.update({
                    where: { id: toKeep[i].id },
                    data: { sortOrder: i }
                });
            }
        }
    }

    console.log(`\n✅ Finished! Deleted ${totalDeleted} redundant slots across all clips.`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
