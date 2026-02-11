
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'file:./dev.db'
        }
    }
});

async function main() {
    try {
        console.log('Verifying Recovery...');

        const clipCount = await prisma.clip.count();
        console.log('Clips:', clipCount);

        const vibeCount = await prisma.vibe.count();
        console.log('Vibes:', vibeCount);

        // Media isn't in Prisma Client yet? 
        // Wait, `prisma generate` was run on `prod_v2` schema which had Media.
        // So `prisma.media` should exist if the client is up to date.
        // But `dev.db` schema now has Media too.
        const mediaCount = await prisma.media.count();
        console.log('Media:', mediaCount);

    } catch (e) {
        console.error('Error verifying:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
