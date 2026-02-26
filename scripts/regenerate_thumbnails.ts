import { PrismaClient } from '@prisma/client';
import { generateThumbnail } from '../src/lib/thumbnail-generator';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching clips with resultUrls to regenerate HD thumbnails...');
    const clips = await prisma.clip.findMany({
        where: {
            resultUrl: { not: null },
            AND: [
                { resultUrl: { not: '' } }
            ]
        }
    });

    console.log(`Found ${clips.length} clips with results.`);

    for (const clip of clips) {
        if (!clip.resultUrl) continue;

        console.log(`Processing Clip ${clip.id}...`);
        try {
            const thumbnailPath = await generateThumbnail(clip.resultUrl, clip.id.toString());
            if (thumbnailPath) {
                await prisma.clip.update({
                    where: { id: clip.id },
                    data: { thumbnailPath }
                });
                console.log(`✅ Thumbnail updated for clip ${clip.id}: ${thumbnailPath}`);
            } else {
                console.log(`⚠️ Failed to generate thumbnail for clip ${clip.id}`);
            }
        } catch (error) {
            console.error(`❌ Error on clip ${clip.id}:`, error);
        }
    }

    console.log('✅ Done! All thumbnails regenerated in HD.');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
