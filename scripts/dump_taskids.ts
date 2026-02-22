import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("=== ARCRUNNER DATABASE: DUMP TASK IDS ===\n");

    const clips = await prisma.clip.findMany({
        where: {
            taskId: { not: null }
        },
        include: { mediaResults: true }
    });

    console.log(`Found ${clips.length} clips with a taskId.`);

    for (const clip of clips) {
        if (clip.taskId === '') continue;
        console.log(`[Clip ${clip.id}] taskId: "${clip.taskId}", resultUrl: "${clip.resultUrl}", status: "${clip.status}", mediaResults: ${clip.mediaResults.length}`);
    }

    await prisma.$disconnect();
}

main().catch(console.error);
