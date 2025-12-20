// @ts-nocheck
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function watch() {
    console.log("👀 Watching for Clip updates (dev.db)...");
    let lastStates = new Map(); // id -> string (status)

    while (true) {
        try {
            // Find recently updated clips or clips in active states
            const clips = await prisma.clip.findMany({
                where: {
                    OR: [
                        { status: 'Pending' },
                        { status: 'Generating' },
                        { status: 'Uploading' },
                        { status: 'Done' }
                    ]
                },
                orderBy: { id: 'desc' },
                take: 10
            });

            for (const clip of clips) {
                const key = clip.id;
                const state = `${clip.status} [${clip.taskId || 'No Task'}]`;

                if (!lastStates.has(key)) {
                    console.log(`[New] Clip ${clip.id} '${clip.title}': ${state}`);
                    lastStates.set(key, state);
                } else if (lastStates.get(key) !== state) {
                    console.log(`[Update] Clip ${clip.id}: ${lastStates.get(key)} -> ${state}`);
                    if (clip.status === 'Done') console.log(`   ✅ Result: ${clip.resultUrl}`);
                    if (clip.status.includes('Error')) console.log(`   ❌ Error: ${state}`);
                    lastStates.set(key, state);
                }
            }

        } catch (e) {
            console.error("Watch Error:", e.message);
        }

        await new Promise(r => setTimeout(r, 2000));
    }
}

watch();
