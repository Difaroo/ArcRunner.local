import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixGeneratingClips() {
    console.log("=== ARCRUNNER DATABASE: FIX GENERATING CLIPS ===\n");

    try {
        // 1. Find all clips stuck in "Generating"
        // Find all clips with a taskId or status that looks like generating
        const suspiciousClips = await prisma.clip.findMany({
            where: {
                OR: [
                    { status: { in: ['Generating', 'generating', 'Pending', 'pending'] } },
                    { taskId: { not: null } }
                ]
            },
            include: { mediaResults: true }
        });

        // Additional filter for empty string because SQLite/Prisma `not` can be quirky
        const stuckClips = suspiciousClips.filter(c => c.status === 'Generating' || c.status === 'generating' || (c.taskId && c.taskId.trim() !== ''));

        console.log(`Found ${stuckClips.length} clips with generation logic attached.`);

        let readyCount = 0;
        let doneCount = 0;

        for (const clip of stuckClips) {
            const hasResult = clip.resultUrl !== null && clip.resultUrl !== '' || (clip.mediaResults && clip.mediaResults.length > 0);
            const newStatus = hasResult ? 'Done' : 'Ready';

            const updateData: any = {};
            if (clip.status !== newStatus) updateData.status = newStatus;

            // Aggressively clear taskId if no result, or if we want to reset it entirely.
            // If it's done, keep taskId? Better to keep it for records unless user wants to clear.
            if (!hasResult && clip.taskId) {
                updateData.taskId = null;
            }

            if (Object.keys(updateData).length > 0) {
                await prisma.clip.update({
                    where: { id: clip.id },
                    data: updateData
                });
                console.log(`Updated Clip ${clip.id} -> ${newStatus} (hadResult: ${hasResult}, taskId: ${clip.taskId})`);
            }

            if (hasResult) doneCount++; else readyCount++;
        }

        console.log(`\n✅ Finished updating clips:`);
        console.log(`   - ${readyCount} clips reset to 'Ready'.`);
        console.log(`   - ${doneCount} clips updated to 'Done'.`);

    } catch (error) {
        console.error("Error fixing clips:", error);
    } finally {
        await prisma.$disconnect();
    }
}

fixGeneratingClips();
