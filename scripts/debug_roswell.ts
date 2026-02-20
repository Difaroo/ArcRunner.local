
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Listing all clips with "Roswell" or "Crash"...');
    const clips = await prisma.clip.findMany({
        where: {
            OR: [
                { title: { contains: 'Roswell' } },
                { action: { contains: 'Roswell' } },
                { title: { contains: 'Crash' } },
                { scene: { contains: '1.1' } }
            ]
        },
        include: {
            mediaReferences: true,
            episode: true
        },
        take: 5
    });

    clips.forEach(clip => {
        console.log(`\nFound Clip: ${clip.title} (ID: ${clip.id}, Scene: ${clip.scene})`);
        console.log(`- Episode ID: ${clip.episodeId}`);
        console.log(`- Media References: ${clip.mediaReferences.length}`);
        clip.mediaReferences.forEach(m => {
            console.log(`  > Media ID: ${m.id} | EpID: ${m.episodeId} | ${m.url.substring(0, 20)}...`);
        });
    });

    console.log('\nSearching for clips with > 5 media references...');
    const allClips = await prisma.clip.findMany({
        include: {
            mediaReferences: true
        }
    });

    const heavyClips = allClips.filter(c => c.mediaReferences.length > 5);
    console.log(`Found ${heavyClips.length} clips with > 5 refs.`);

    heavyClips.forEach(c => {
        console.log(`- Clip: ${c.title} (Scene ${c.scene}, ID: ${c.id}) has ${c.mediaReferences.length} refs.`);
        console.log(`  EpisodeId: ${c.episodeId}`);
    });

    const targetEpId = '088f7570-1797-4f31-92e4-13ca7c67b39a';
    console.log(`\nInspecting Media for Episode: ${targetEpId}`);

    const mediaInEp = await prisma.media.findMany({
        where: { episodeId: targetEpId }
    });
    console.log(`Found ${mediaInEp.length} media records directly linked to Episode.`);

    // Summary of types
    const types = mediaInEp.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
    }, {});
    console.log('Media Types:', types);

    // Detailed breakdown of the 51 items to explain their origin
    console.log('\n--- DETAILED MEDIA ANALYSIS ---');
    console.log(`Total DB Records for Episode: ${mediaInEp.length}`);

    // Group by Date to see if they were bulk imported
    const byDate = mediaInEp.reduce((acc, m) => {
        const date = m.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {});
    console.log('Created Dates:', byDate);

    // Group by Category
    const byCat = mediaInEp.reduce((acc, m) => {
        acc[m.category] = (acc[m.category] || 0) + 1;
        return acc;
    }, {});
    console.log('Categories:', byCat);

    // Check Thumbnail Paths for Videos
    const videos = mediaInEp.filter(m => m.type === 'VIDEO');
    console.log(`\nVideos: ${videos.length}`);
    videos.forEach(v => {
        console.log(`- [${v.id.substring(0, 8)}] ${v.category} | Thumb: ${v.thumbnailPath ? 'YES' : 'NULL'} | URL: ${v.url.substring(0, 40)}...`);
    });

    // List the image filenames to help user recognize them
    console.log('\nImage Filenames (First 10):');
    mediaInEp.filter(m => m.type === 'IMAGE').slice(0, 10).forEach(m => {
        const filename = m.url.split('/').pop();
        console.log(`- ${filename} (${m.category})`);
    });


    // Check URLs for tempfile
    const tempFiles = mediaInEp.filter(m => m.url.includes('tempfile'));
    console.log(`Found ${tempFiles.length} tempfile URLs in this episode.`);

    // Check Local Files Existence
    const fs = require('fs');
    const path = require('path');

    console.log('\nChecking local file existence for first 5 items...');
    mediaInEp.slice(0, 5).forEach(m => {
        if (m.url.startsWith('/api/media/uploads/')) {
            // Assume mapped to public/uploads or keys
            // Actually, /api/media routes are internal. 
            // Let's just check if we can find the file in public/uploads if it matches that pattern
            const filename = m.url.split('/').pop();
            // This is a guess on storage path, but let's try standard locations
            const publicPath = path.join(process.cwd(), 'public', 'uploads', filename);
            const exists = fs.existsSync(publicPath);
            console.log(`- ${filename}: ${exists ? 'EXISTS' : 'MISSING'} (${publicPath})`);
        }
    });

    console.log('\nChecking Studio Items...');
    const studioItems = await prisma.studioItem.findMany();
    console.log(`Total Studio Items in DB: ${studioItems.length}`);

    // Check if they are linked to this episode's media?
    const studioMedia = await prisma.media.findMany({
        where: {
            episodeId: targetEpId,
            studioItemId: { not: null }
        }
    });
    console.log(`Media in this episode linked to Studio Items: ${studioMedia.length}`);
    if (!clip) {
        console.log('Clip not found.');
        return;
    }

    console.log(`Found Clip: ${clip.title} (ID: ${clip.id})`);
    console.log(`- Episode ID: ${clip.episodeId} (UUID: ${clip.episode.id})`); // Confirm mismatch or match
    console.log(`- Media References: ${clip.mediaReferences.length}`);

    clip.mediaReferences.forEach(m => {
        console.log(`  > Media ID: ${m.id}`);
        console.log(`    - URL: ${m.url.substring(0, 40)}...`);
        console.log(`    - Category: ${m.category}`);
        console.log(`    - EpisodeId (On Media): ${m.episodeId}`); // THIS IS THE KEY CHECK

        const isMatch = m.episodeId === clip.episodeId;
        console.log(`    - Linked correctly? ${isMatch ? 'YES' : 'NO'}`);
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
