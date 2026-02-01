
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const db = new PrismaClient();

async function main() {
    console.log('--- Fixing Legacy Results ---');

    // Find Clips with resultUrl but NO Media Result
    const clips = await db.clip.findMany({
        where: {
            resultUrl: { not: '' },
            mediaResults: { none: {} } // No relational records
        },
        include: { episode: true }
    });

    console.log(`Found ${clips.length} legacy clips.`);

    for (const clip of clips) {
        if (!clip.resultUrl) continue;

        console.log(`Migrating Clip ${clip.id}: ${clip.resultUrl}`);

        await db.media.create({
            data: {
                id: uuidv4(),
                url: clip.resultUrl,
                type: 'VIDEO', // Assumption for Results
                category: 'RESULT',
                resultForClipId: clip.id,
                episodeId: clip.episodeId
            }
        });
    }

    console.log('--- Fixing Legacy References ---');

    // Fetch ALL clips to be safe
    const allClips = await db.clip.findMany();

    for (const clip of allClips) {
        if (!clip.refImageUrls) continue;

        const refs = clip.refImageUrls.split(',').map(s => s.trim()).filter(Boolean);

        for (const url of refs) {
            // Check if Media exists for this URL + Clip combination
            const exists = await db.media.findFirst({
                where: {
                    url: url,
                    referenceForClipId: clip.id,
                    category: 'REFERENCE'
                }
            });

            if (!exists) {
                console.log(`Migrating Ref for Clip ${clip.id}: ${url}`);
                await db.media.create({
                    data: {
                        id: uuidv4(),
                        url: url,
                        type: url.match(/\.(mp4|mov|webm)$/i) ? 'VIDEO' : 'IMAGE',
                        category: 'REFERENCE',
                        referenceForClipId: clip.id,
                        episodeId: clip.episodeId
                    }
                });
            }
        }
    }

    console.log('Done.');
}

main()
    .catch(e => console.error(e))
    .finally(() => db.$disconnect());
