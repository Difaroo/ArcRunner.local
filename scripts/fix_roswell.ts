
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const targetEpId = '088f7570-1797-4f31-92e4-13ca7c67b39a';
    console.log(`Cleaning up broken media for Episode: ${targetEpId}`);

    const mediaInEp = await prisma.media.findMany({
        where: { episodeId: targetEpId }
    });

    console.log(`Found ${mediaInEp.length} total media candidates.`);

    const toDelete: string[] = [];

    for (const m of mediaInEp) {
        let isBroken = false;

        // 1. Check Tempfiles (Expired)
        if (m.url.includes('tempfile')) {
            console.log(`[DELETE] Expired Tempfile: ${m.id} (${m.url})`);
            isBroken = true;
        }

        // 2. Check Local Uploads (Missing)
        else if (m.url.startsWith('/api/media/uploads/')) {
            const filename = m.url.split('/').pop();
            const publicPath = path.join(process.cwd(), 'public', 'uploads', filename || '');

            if (!fs.existsSync(publicPath)) {
                console.log(`[DELETE] Missing File: ${m.id} (${filename})`);
                isBroken = true;
            }
        }

        if (isBroken) {
            toDelete.push(m.id);
        }
    }

    console.log(`\nFound ${toDelete.length} broken records to delete.`);

    if (toDelete.length > 0) {
        const result = await prisma.media.deleteMany({
            where: {
                id: { in: toDelete }
            }
        });
        console.log(`Deleted ${result.count} records.`);
    } else {
        console.log('No records deleted.');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
