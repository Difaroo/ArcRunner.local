
import { db } from '@/lib/db';

async function main() {
    // Find clips that might refer to Jack_Parsons_Roswell
    // We'll search by character string
    const clips = await db.clip.findMany({
        where: { character: { contains: 'Jack' } }
    });

    if (clips.length === 0) {
        console.log('No clips found with character containing "Jack"');
    } else {
        clips.forEach(clip => {
            console.log(`Clip ID: ${clip.id}`);
            console.log(`  Character: '${clip.character}'`);
            console.log(`  RefImageUrls (Cache): '${clip.refImageUrls}'`);

            console.log('---');
        });
    }
}

main();
