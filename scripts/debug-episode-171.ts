
import { db } from '@/lib/db';

async function main() {
    const clip = await db.clip.findUnique({
        where: { id: 171 },
        include: { episode: true }
    });
    console.log('--- DB STATE ---');
    console.log(`Clip Model: ${clip?.model}`);
    console.log(`Episode Model: ${clip?.episode?.model}`);
    console.log(`Episode ID: ${clip?.episodeId}`);
}

main().catch(console.error);
