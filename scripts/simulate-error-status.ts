
import { GenerateManager } from '../src/lib/generate-manager';
import { db } from '../src/lib/db';
import { VeoStrategy, FluxStrategy } from '../src/lib/kie-strategies';

// Monkey Patch Kie Strategies to Throw 500
const originalVeo = VeoStrategy.prototype.createTask;
VeoStrategy.prototype.createTask = async () => {
    throw new Error('Kie API Error: 500 Internal Server Error');
};

async function verifyErrorStatus() {
    console.log("=== Error Status Logic Verification ===");

    // Mock DB Update (since we can't really update infinite ID)
    // We will spy on the DB logic or just catch the error and inspect logging?

    // We can't easily spy on db.clip.update without a real mocking lib.
    // But we modified GenerateManager to log "Failed to update error status" if DB fails.
    // If DB works, we assume it writes.

    // Let's create a real dummy clip in DB to update?
    const clip = await db.clip.create({
        data: {
            episodeId: '99999', // Likely fail constraint unless we look one up
            title: 'Error Test',
            status: 'Pending',
            start: 0, end: 10
        }
    }).catch(async (e) => {
        // Fallback: Find existing
        return await db.clip.findFirst();
    });

    if (!clip) {
        console.error("No clip available to test.");
        return;
    }

    console.log(`Using Clip ID: ${clip.id}`);

    const manager = new GenerateManager();

    try {
        await manager.startTask({
            clipId: String(clip.id),
            seriesId: "1",
            model: "veo-test",
            clip: { prompt: "Test" }
        });
    } catch (e: any) {
        console.log(`Caught Expected Error: ${e.message}`);
    }

    // Verify DB Status
    const updated = await db.clip.findUnique({ where: { id: clip.id } });
    console.log(`Final DB Status: '${updated?.status}'`);

    if (updated?.status === 'Error 500') {
        console.log("✅ SUCCESS: Status correctly updated to 'Error 500'");
    } else {
        console.log(`❌ FAILURE: Status is '${updated?.status}'`);
    }
}

verifyErrorStatus();
