
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import { convertDriveUrl } from '@/lib/utils';
// @ts-ignore
import { processRefUrls } from '@/lib/image-processing';

const db = new PrismaClient();

async function main() {
    console.log('--- DEFAULT THUMBNAIL DEBUGGER ---');

    // 1. Fetch Library Items
    const libraryItems = await db.studioItem.findMany();
    console.log(`Found ${libraryItems.length} Studio Items.`);

    const libMap: Record<string, string> = {};
    libraryItems.forEach(item => {
        if (item.name) {
            libMap[item.name.toLowerCase()] = item.refImageUrl || 'NO_URL';
            console.log(`[LIB] Name: "${item.name}" -> URL: ${item.refImageUrl ? 'Yes' : 'No'}`);
        }
    });

    // 2. Fetch Clips with Characters
    const clips = await db.clip.findMany({
        where: {
            OR: [
                { character: { not: '' } },
                { character: { not: null } }
            ]
        },
        take: 10
    });

    console.log(`\nInspecting ${clips.length} Clips...`);

    clips.forEach(clip => {
        if (!clip.character) return;

        console.log(`\n[CLIP ${clip.id}] Char String: "${clip.character}"`);
        const names = clip.character.split(',').map(c => c.trim());

        names.forEach(n => {
            const match = libMap[n.toLowerCase()];
            const exactMatch = libMap[n];

            if (match) {
                console.log(`  -> "${n}" MATCHES! URL: ${match}`);
            } else {
                console.log(`  -> "${n}" NO MATCH.`);
                // Fuzzy check?
                const fuzzy = Object.keys(libMap).find(k => k.replace(/_/g, ' ') === n.toLowerCase() || k === n.toLowerCase().replace(/ /g, '_'));
                if (fuzzy) {
                    console.log(`     (Did you mean "${fuzzy}"? Underscore mismatch!)`);
                }
            }
        });
    });
    // 3. Fix Broken Link
    console.log('\n[FIX] Updating Candy_Rocketman to use valid file...');
    const target = await db.studioItem.findFirst({ where: { name: 'Candy_Rocketman' } });
    if (target) {
        await db.studioItem.update({
            where: { id: target.id },
            data: { refImageUrl: '/api/media/uploads/Candy-Look.jpg' } // Use valid file
        });
        console.log('Updated Candy_Rocketman URL to Candy-Look.jpg');
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await db.$disconnect()
    })
