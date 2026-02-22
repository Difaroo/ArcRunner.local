import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("=== ARCRUNNER DATABASE: DEBUG GENERATING CLIPS ===\n");

    const allClips = await prisma.clip.findMany({
        include: { mediaResults: true }
    });

    let stuckCount = 0;

    for (const clip of allClips) {
        // Mimic clip-status.ts EXACTLY
        const hasMediaResults = (clip.mediaResults && clip.mediaResults.length > 0);
        const hasResultUrl = !!clip.resultUrl && clip.resultUrl !== '';

        if (!hasMediaResults && !hasResultUrl) {
            // It has NO results
            if (clip.taskId && clip.taskId.trim() !== '') {
                console.log(`STUCK: Clip ${clip.id} (scene: ${clip.scene}) has taskId "${clip.taskId}" but NO results! Status is: ${clip.status}`);
                stuckCount++;

                await prisma.clip.update({
                    where: { id: clip.id },
                    data: {
                        status: 'Ready',
                        taskId: ''
                    }
                });
            } else if (clip.status === 'Generating' || clip.status === 'generating') {
                console.log(`STUCK: Clip ${clip.id} (scene: ${clip.scene}) has status "${clip.status}" but NO results! Status is: ${clip.status}`);
                stuckCount++;
                await prisma.clip.update({
                    where: { id: clip.id },
                    data: {
                        status: 'Ready',
                        taskId: ''
                    }
                });
            }
        }
    }

    console.log(`\nFound and fixed ${stuckCount} truly stuck clips without results.`);
    await prisma.$disconnect();
}

main().catch(console.error);
