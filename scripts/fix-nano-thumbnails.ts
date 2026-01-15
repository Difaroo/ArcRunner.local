
import { db } from '../src/lib/db.ts';
import { generateThumbnail } from '../src/lib/thumbnail-generator.ts';

async function main() {
    console.log("Starting Nano Thumbnail Backfill...");

    // Find candidates: Nano model, Done, Video URL, Missing Thumbnail
    const clips = await db.clip.findMany({
        where: {
            model: { contains: 'nano' },
            status: 'Done'
        }
    });

    console.log(`Found ${clips.length} Nano clips needing thumbnails.`);

    for (const clip of clips) {
        if (!clip.resultUrl) continue;

        console.log(`Processing Clip ${clip.id} (${clip.resultUrl})...`);
        try {
            const thumbPath = await generateThumbnail(clip.resultUrl, clip.id.toString());
            if (thumbPath) {
                await db.clip.update({
                    where: { id: clip.id },
                    data: { thumbnailPath: thumbPath }
                });
                console.log(`  -> Fixed! Thumbnail: ${thumbPath}`);
            } else {
                console.warn(`  -> Failed to generate thumbnail (returned null)`);
            }
        } catch (error) {
            console.error(`  -> Error processing clip ${clip.id}:`, error);
        }
    }

    console.log("Backfill Complete.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await db.$disconnect();
    });
