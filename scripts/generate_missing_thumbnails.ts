import { PrismaClient } from '@prisma/client';
import { generateThumbnail } from '../src/lib/thumbnail-generator';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('🖼️ Starting Batch Thumbnail Generator for local videos...\n');

    // Find all clips with local video URLs but no thumbnail
    const clips = await prisma.clip.findMany({
        where: {
            resultUrl: { startsWith: '/media/clips/' },
            OR: [
                { thumbnailPath: null },
                { thumbnailPath: '' }
            ]
        }
    });

    console.log(`Found ${clips.length} local videos needing a thumbnail.`);

    let successCount = 0;

    for (const clip of clips) {
        console.log(`Processing Clip ${clip.scene} (ID: ${clip.id})...`);
        try {
            // Because thumbnail-generator automatically prepends process.cwd()/public for /media/paths...
            const thumbUrl = await generateThumbnail(clip.resultUrl, clip.id.toString());

            if (thumbUrl) {
                await prisma.clip.update({
                    where: { id: clip.id },
                    data: { thumbnailPath: thumbUrl }
                });
                console.log(`✅ Generated thumbnail for ${clip.scene}: ${thumbUrl}`);
                successCount++;
            } else {
                console.log(`❌ Failed to generate thumbnail for ${clip.scene}.`);
            }
        } catch (e: any) {
            console.error(`❌ Error on Clip ${clip.scene}:`, e.message);
        }
    }

    console.log(`\n🎉 Finished! Generated ${successCount}/${clips.length} thumbnails.`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
