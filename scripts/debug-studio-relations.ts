
import { db } from '@/lib/db';

async function main() {
    const charName = 'Jack_Parsons_Roswell';

    // 1. Get Studio Item
    const items = await db.studioItem.findMany({
        where: { name: charName },
        include: { series: true }
    });

    if (items.length === 0) {
        console.log(`Studio Item '${charName}' not found.`);
    } else {
        items.forEach(item => {
            console.log(`Studio Item: ${item.name} (ID: ${item.id})`);
            console.log(`  Series ID: ${item.seriesId}`);
            console.log(`  Series Name: ${item.series.name}`);
        });
    }

    // 2. Get Clip 177
    const clipId = 177;
    const clip = await db.clip.findUnique({
        where: { id: clipId },
        include: { episode: { include: { series: true } } }
    });

    if (!clip) {
        console.log(`Clip ${clipId} not found.`);
    } else {
        console.log(`Clip: ${clip.id} Scene: ${clip.scene}`);
        console.log(`  Character: ${clip.character}`);
        console.log(`  Episode ID: ${clip.episodeId}`);
        console.log(`  Series ID: ${clip.episode.seriesId}`);
        console.log(`  Series Name: ${clip.episode.series.name}`);
    }
}

main();
