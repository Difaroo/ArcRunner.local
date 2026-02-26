import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Starting Legacy Remediation for Clip 1.50.2 ...');

    const clip = await prisma.clip.findFirst({
        where: { scene: { contains: '1.50.2' } },
        include: {
            episode: { select: { seriesId: true } },
            modelInputSlots: {
                include: { media: true, studioItem: true }
            }
        }
    });

    if (!clip) {
        console.error('Clip not found!');
        return;
    }

    console.log(`Processing Clip: ${clip.scene} (ID ${clip.id})`);
    console.log(`Current Slots: ${clip.modelInputSlots.length}`);

    // Parse intended structural dependencies
    const targetLocs = (clip.location || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const targetChars = (clip.character || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    // Fetch Studio Items to match against
    const allStudioItems = await prisma.studioItem.findMany({
        where: { seriesId: clip.episode.seriesId }
    });

    const resolvedStudioItems: any[] = [];
    const resolvedUrls = new Set<string>();

    for (const item of allStudioItems) {
        const sName = item.name.toLowerCase();
        let matches = false;

        if (targetLocs.some(l => sName.includes(l) || l.includes(sName)) && item.type.includes('LOCATION')) {
            matches = true;
        } else if (targetChars.some(c => sName.includes(c) || c.includes(sName)) && item.type.includes('CHARACTER')) {
            matches = true;
        }

        if (matches) {
            resolvedStudioItems.push(item);
            if (item.refImageUrl) {
                const urls = item.refImageUrl.split(',').map(u => u.trim());
                urls.forEach(u => resolvedUrls.add(u));
            }
        }
    }

    console.log(`\nIdentified ${resolvedStudioItems.length} Native Studio Items structurally required by text fields:`);
    resolvedStudioItems.forEach(s => console.log(` - ${s.name} (Type: ${s.type})`));

    // Find pure, non-duplicate explicit Media Reference Slots
    const explicitMediaSlots = clip.modelInputSlots.filter(slot => {
        if (!slot.media) return false;
        // Exclude the buggy proxy backups (STUDIO_UPLOAD)
        if (slot.media.category === 'STUDIO_UPLOAD') return false;

        // Exclude if the literal URL is a duplicate of a resolved Studio Item URL
        if (resolvedUrls.has(slot.media.url)) return false;

        return true;
    });

    console.log(`\nIdentified ${explicitMediaSlots.length} Unique Explicit Media Uploads that survive deduplication.`);

    // ==============================================
    // DRY RUN LOGIC (EXECUTE TRUE REBUILD)
    // ==============================================
    console.log('\n🗑️ PURGING ALL LEGACY SLOTS...');
    await prisma.modelInputSlot.deleteMany({
        where: { clipId: clip.id }
    });

    console.log('🏗️ REBUILDING STRICT ARCHITECTURE SLOTS...');
    let sortOrderTracker = 0;

    // 1. Insert Studio Items first
    for (const item of resolvedStudioItems) {
        await prisma.modelInputSlot.create({
            data: {
                clipId: clip.id,
                studioItemId: item.id,
                sortOrder: sortOrderTracker++
            }
        });
        console.log(` + Created Studio Slot: ${item.name}`);
    }

    // 2. Insert surviving Explicit Media
    for (const slot of explicitMediaSlots) {
        await prisma.modelInputSlot.create({
            data: {
                clipId: clip.id,
                mediaId: slot.media!.id,
                sortOrder: sortOrderTracker++
            }
        });
        console.log(` + Created Explicit Media Slot: ${slot.media!.url}`);
    }

    // Verify Output
    const finalSlots = await prisma.modelInputSlot.count({ where: { clipId: clip.id } });
    console.log(`\n✅ Remediation Complete! Clip ${clip.scene} now has ${finalSlots} strict architecture slots (Down from ${clip.modelInputSlots.length}).`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
