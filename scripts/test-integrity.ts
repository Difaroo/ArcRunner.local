
import { db } from '../src/lib/db';
import { GenerateManager } from '../src/lib/generate-manager';

async function main() {
    console.log('🧪 Starting Integrity Test: Model Persistence...');

    // 1. Enable Mock Mode
    process.env.MOCK_KIE = 'true';

    // 2. Setup Test Data
    const TEST_SERIES_ID = 'TEST-SERIES-Integrity';
    const TEST_EPISODE_NUM = 999;
    const TEST_CLIP_TITLE = 'Integrity Test Clip';

    try {
        // Clean previous run if exists
        await cleanup(TEST_SERIES_ID);

        console.log('📝 Creating Test Data...');
        const series = await db.series.create({
            data: {
                id: TEST_SERIES_ID,
                name: 'Integrity Test Series',
            }
        });

        const episode = await db.episode.create({
            data: {
                seriesId: series.id,
                number: TEST_EPISODE_NUM,
                title: 'Test Episode'
            }
        });

        const clip = await db.clip.create({
            data: {
                episodeId: episode.id,
                status: 'Ready',
                title: TEST_CLIP_TITLE,
                sortOrder: 1,
                action: 'A robot verifying data integrity.',
                camera: 'Wide shot',
                style: 'Cyberpunk'
            }
        });

        console.log(`✅ Test Clip Created: ID ${clip.id}`);

        // 3. Execute Generation
        console.log('🚀 Running GenerateManager (Mocked)...');
        const manager = new GenerateManager();

        // Use Nano model to verifies specifics
        const TARGET_MODEL = 'nano-banana-pro';

        await manager.startTask({
            clipId: clip.id.toString(),
            seriesId: series.id,
            model: TARGET_MODEL,
            prompt: 'Test Prompt',
            clip: clip as any // Cast to satisfy extended type requirements for test
        });

        // 4. Verify Persistence
        console.log('🔍 Verifying Database State...');
        const updatedClip = await db.clip.findUnique({
            where: { id: clip.id }
        });

        if (!updatedClip) throw new Error('Clip verified missing!');

        console.log(`   Task ID: ${updatedClip.taskId}`);
        console.log(`   Model:   ${updatedClip.model}`);
        console.log(`   Status:  ${updatedClip.status}`);

        // ASSERTIONS
        if (!updatedClip.taskId || !updatedClip.taskId.startsWith('MOCK-TASK')) {
            throw new Error(`❌ Integrity Fail: Task ID not generated or not mocked. Got: ${updatedClip.taskId}`);
        }

        if (updatedClip.model !== TARGET_MODEL) {
            throw new Error(`❌ Integrity Fail: Model name NOT persisted. Expected '${TARGET_MODEL}', Got '${updatedClip.model}'`);
        }

        if (updatedClip.status !== 'Generating') {
            throw new Error(`❌ Integrity Fail: Status should be 'Generating'. Got '${updatedClip.status}'`);
        }

        console.log('✅ Integrity Test Passed: Model Persistence Verified.');

    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    } finally {
        await cleanup(TEST_SERIES_ID);
        await db.$disconnect();
    }
}

async function cleanup(seriesId: string) {
    try {
        // Delete cascading (if Prisma supports it, manually otherwise)
        // Manual cleanup for safety
        const series = await db.series.findUnique({ where: { id: seriesId }, include: { episodes: { include: { clips: true } } } });
        if (series) {
            for (const ep of series.episodes) {
                await db.clip.deleteMany({ where: { episodeId: ep.id } });
            }
            await db.episode.deleteMany({ where: { seriesId: series.id } });
            await db.series.delete({ where: { id: series.id } });
            console.log('🧹 Cleanup Complete.');
        }
    } catch (e) {
        console.warn('Cleanup warning:', e);
    }
}

main();
