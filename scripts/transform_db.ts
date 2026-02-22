import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function transform() {
    console.log("=== ARCRUNNER DATABASE TRANSFORMATION ===\\n");

    // 1. Fix Clip Statuses: completed clips
    const clipsToDone = await prisma.clip.findMany({
        where: {
            OR: [
                { resultUrl: { not: null } },
                { mediaResults: { some: {} } }
            ],
            status: { not: 'Done' }
        }
    });

    if (clipsToDone.length > 0) {
        console.log(`Updating ${clipsToDone.length} Clips to 'Done' because they have results...`);
        const updateDone = await prisma.clip.updateMany({
            where: { id: { in: clipsToDone.map(c => c.id) } },
            data: { status: 'Done' }
        });
        console.log(` -> Updated ${updateDone.count} clips.`);
    }

    // 2. Fix Clip Statuses: pending clips
    const clipsToPending = await prisma.clip.findMany({
        where: {
            resultUrl: null,
            mediaResults: { none: {} },
            status: 'Done'
        }
    });

    if (clipsToPending.length > 0) {
        console.log(`Updating ${clipsToPending.length} Clips to 'Pending' because they lack results...`);
        const updatePending = await prisma.clip.updateMany({
            where: { id: { in: clipsToPending.map(c => c.id) } },
            data: { status: 'Pending' }
        });
        console.log(` -> Updated ${updatePending.count} clips.`);
    }

    // 3. Fix StudioItem Statuses
    const studioItemsToDone = await prisma.studioItem.findMany({
        where: {
            refImageUrl: { not: null },
            status: { not: 'DONE' }
        }
    });

    if (studioItemsToDone.length > 0) {
        console.log(`Updating ${studioItemsToDone.length} StudioItems to 'DONE' because they have images...`);
        const updateStudio = await prisma.studioItem.updateMany({
            where: { id: { in: studioItemsToDone.map(s => s.id) } },
            data: { status: 'DONE' }
        });
        console.log(` -> Updated ${updateStudio.count} studio items.`);
    }

    // 4. Delete Orphaned RESULT Media
    const orphanedMedia = await prisma.media.findMany({
        where: {
            category: 'RESULT',
            resultForClipId: null
        }
    });

    if (orphanedMedia.length > 0) {
        console.log(`Deleting ${orphanedMedia.length} orphaned RESULT Media items...`);
        const deleteMedia = await prisma.media.deleteMany({
            where: { id: { in: orphanedMedia.map(m => m.id) } }
        });
        console.log(` -> Deleted ${deleteMedia.count} media items.`);
    }

    // 5. Fix StudioItem 256 (Missing Media Record)
    const brokenStudioItems = await prisma.studioItem.findMany({
        where: {
            refImageUrl: { not: null },
            media: { none: {} }
        }
    });

    for (const si of brokenStudioItems) {
        console.log(`Creating missing Media record for StudioItem ${si.id} (${si.name})...`);
        await prisma.media.create({
            data: {
                url: si.refImageUrl!,
                type: 'IMAGE',
                category: 'STUDIO_UPLOAD',
                studioItemId: si.id
            }
        });
        console.log(` -> Created Media for StudioItem ${si.id}.`);
    }

    console.log("\\n✅ Transformation complete.");
}

transform()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
