console.log(`[DEBUG] CWD: ${process.cwd()}`);
console.log(`[DEBUG] DATABASE_URL: ${process.env.DATABASE_URL}`);

import fs from 'fs';
import path from 'path';

// FORCE CORRECT DB
const devDbPath = path.resolve(process.cwd(), 'prisma/dev.db');
if (fs.existsSync(devDbPath)) {
    console.log(`[DEBUG] Forcing DATABASE_URL to: file:${devDbPath}`);
    process.env.DATABASE_URL = `file:${devDbPath}`;
} else {
    console.error(`[ERROR] prisma/dev.db not found at ${devDbPath}`);
}
console.log(`[DEBUG] Final DATABASE_URL: ${process.env.DATABASE_URL}`);

async function verify() {
    try {
        // Use dynamic imports to ensure env var is set BEFORE Prisma initializes
        const { GenerateManager } = await import('../src/lib/generate-manager');
        const { db } = await import('../src/lib/db');

        console.log('Verifying Generation Prompt...');
        const manager = new GenerateManager();

        // Use the clip ID from our previous persistence verification (325)
        const clipId = 325;
        const clip = await db.clip.findUnique({
            where: { id: clipId }
        });

        if (!clip) {
            console.error('Test Clip 325 not found!');
            process.exit(1);
        }

        console.log(`Found Clip: ${clip.title} (ID: ${clip.id})`);
        console.log(`Movement Field in DB: "${clip.movement}"`);

        const input = {
            clipId: String(clip.id),
            seriesId: clip.series || '1',
            clip: clip, // Pass the full clip object
            dryRun: true,
            model: 'veo-2' // Mock model
        };

        try {
            const result = await manager.startTask(input);

            console.log('\n--- GENERATION RESULT ---');
            // console.log(JSON.stringify(result, null, 2));

            if (result.debugPayload) {
                console.log('Debug Payload Found');
                // Check for prompt in payload (structure depends on builder, likely 'input.prompt' or 'prompt')
                const prompt = result.debugPayload.prompt || result.debugPayload.input?.prompt;
                console.log('\n--- CONSTRUCTED PROMPT ---');
                console.log(prompt);

                if (prompt && prompt.includes(`MOVEMENT: ${clip.movement}`)) {
                    console.log('\n✅ SUCCESS: Movement field found in prompt!');
                } else {
                    console.error('\n❌ FAILURE: Movement field MISSING from prompt.');
                    console.log('Expected:', `MOVEMENT: ${clip.movement}`);
                }
            } else {
                console.error('No debug payload returned!');
            }

        } catch (error) {
            console.error('Error during verification:', error);
        } finally {
            await db.$disconnect();
        }
    } catch (err) {
        console.error('Fatal Script Error:', err);
    }
}

verify();
