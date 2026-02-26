import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();
const LOCAL_DIR = '/Users/davidfennell/Documents/~ JOBS current/Rise of the Witches/~ PILOT/CLIPS final/Scene 01';
const EPISODE_ID = '89247336-5b6b-4ba3-b2bf-29a2c7fb9e25'; // Rise of the Witches Ep 1

async function main() {
    console.log('🔍 Starting Emergency Local Media Linker for Episode 1...\n');

    // 1. Get all Episode 1 clips that are broken (tempfile URL or blank)
    const clips = await prisma.clip.findMany({
        where: { episodeId: EPISODE_ID }
    });

    console.log(`Found ${clips.length} total clips in Episode 1.`);

    // 2. Read the local directory
    if (!fs.existsSync(LOCAL_DIR)) {
        console.error(`❌ Local directory does not exist: ${LOCAL_DIR}`);
        return;
    }

    const files = fs.readdirSync(LOCAL_DIR).filter(f => f.endsWith('.mp4') && !f.includes(' 01.mp4') && !f.includes(' 02.mp4') && !f.includes(' 03.mp4')); // exclude symlinks

    console.log(`Found ${files.length} base .mp4 files on disk.`);

    let linkedCount = 0;

    for (const clip of clips) {
        let matchingFile = files.find(f => {
            // Must start with exactly the scene number, e.g. "1.1"
            if (!f.startsWith(clip.scene)) return false;

            // The very next character must be a space, a dot, or a letter (preventing "1.1" matching "1.10")
            const nextChar = f.charAt(clip.scene.length);
            return nextChar === ' ' || nextChar === '.' || /[a-zA-Z]/.test(nextChar);
        });

        if (matchingFile) {
            const absolutePath = path.join(LOCAL_DIR, matchingFile);

            // We need to move/copy this to the public/media/clips folder so the UI can serve it via /api/media/clips
            const destName = `${clip.id}_${Date.now()}.mp4`;
            const publicPath = path.join(process.cwd(), 'public', 'media', 'clips', destName);
            const relativeUrl = `/api/media/clips/${destName}`; // The URL the UI needs

            try {
                // Read original and write to public
                // To save space, we could symlink, but copying is safer for persistence
                fs.copyFileSync(absolutePath, publicPath);

                // Update the database
                await prisma.clip.update({
                    where: { id: clip.id },
                    data: {
                        resultUrl: relativeUrl, // Update Legacy Reference
                        mediaResults: {
                            create: {
                                url: relativeUrl,
                                localPath: absolutePath, // Store original path
                                category: 'RESULT',
                                type: 'VIDEO',
                                episode: { connect: { id: EPISODE_ID } }
                            }
                        }
                    }
                });

                console.log(`✅ Linked: Clip ${clip.scene} -> ${matchingFile}`);
                linkedCount++;

            } catch (err: any) {
                console.error(`❌ Failed to link ${clip.scene}: ${err.message}`);
            }
        } else {
            // console.log(`⚠️ No local file found for Clip ${clip.scene}.`);
        }
    }

    console.log(`\n🎉 Finished! Successfully re-linked ${linkedCount} dead clips to local files.`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
