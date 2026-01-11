
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Verifying Negative Prompt Persistence...');

    // 1. Find a clip
    const clip = await prisma.clip.findFirst();
    if (!clip) {
        console.log('No clips found.');
        return;
    }
    console.log(`Found Clip ID: ${clip.id}, Current Negative: ${clip.negativePrompt}`);

    // 2. Update it
    const testValue = "Test Negative Prompt " + Date.now();
    console.log(`Attempting to update to: "${testValue}"`);

    try {
        const updated = await prisma.clip.update({
            where: { id: clip.id },
            data: { negativePrompt: testValue }
        });
        console.log('Update Success!');
        console.log(`New Value in DB: ${updated.negativePrompt}`);

        // 3. Re-read to be sure
        const check = await prisma.clip.findUnique({ where: { id: clip.id } });
        console.log(`Re-read Value: ${check?.negativePrompt}`);

    } catch (e) {
        console.error('Update Failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
