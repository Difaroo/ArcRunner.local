/**
 * scripts/batch-persist.ts
 * 
 * Batch persistence script to save expiring videos and generate clean symlinks.
 * Created for specific Series targets.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { promisify } from 'util';

const prisma = new PrismaClient();
const SERVER_STORAGE_ROOT = path.join(process.cwd(), 'public', 'media', 'clips');

// Targets
const TARGETS = [
    {
        seriesId: "2",
        seriesTitle: "UFO Invasion",
        userDir: "/Users/davidfennell/Library/CloudStorage/GoogleDrive-difaroo@gmail.com/Other computers/DIF MacBook Pro/~ LIVE/~ CROWDSTATE/UFO INVASION/TRAILER/VIDEO clips persist"
    },
    {
        seriesId: "ac28ec95-63ea-47ee-a190-19253dd939b1",
        seriesTitle: "Rise of the Witches",
        userDir: "/Users/davidfennell/Documents/~ JOBS current/Rise of the Witches/~ PILOT/VIDEO clips persist"
    }
];

// Helper: Safely create directory
function ensureDirSync(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Ensure server storage exists
ensureDirSync(SERVER_STORAGE_ROOT);

async function downloadMedia(url: string, targetPath: string): Promise<boolean> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        if (!response.body) throw new Error(`No response body`);

        const fileStream = fs.createWriteStream(targetPath);

        await new Promise((resolve, reject) => {
            // @ts-ignore
            const body = Readable.fromWeb(response.body as any);
            body.pipe(fileStream);
            body.on('error', reject);
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });

        const stat = fs.statSync(targetPath);
        if (stat.size === 0) {
            console.warn(`[WARN] Downloaded file ${targetPath} is 0 bytes!`);
            return false;
        }
        return true;
    } catch (err: any) {
        console.error(`[ERROR] Download failed for ${url}: ${err.message}`);
        return false;
    }
}

async function main() {
    console.log(`🚀 Starting Batch Persistence Rescue...\n`);

    let totalDownloaded = 0;
    let totalSkipped = 0;

    for (const target of TARGETS) {
        console.log(`=========================================`);
        console.log(`[SERIES] Processing: ${target.seriesTitle}`);
        console.log(`[TARGET DIR] ${target.userDir}`);
        console.log(`=========================================`);

        ensureDirSync(target.userDir);

        // Find all unpersisted HTTP clips for this series
        const clips = await prisma.clip.findMany({
            where: {
                episode: { seriesId: target.seriesId },
                isPersisted: false,
                resultUrl: { startsWith: 'http' },
                status: 'Done' // Ensure it's completed
            },
            include: { episode: true }
        });

        if (clips.length === 0) {
            console.log(`   No un-persisted HTTP clips found for this series.\n`);
            continue;
        }

        console.log(`   Found ${clips.length} clips to persist.\n`);

        for (const clip of clips) {
            console.log(`   -> [${clip.scene}] ${clip.title} (ID: ${clip.id})`);

            // 1. Setup Episode Folders & DB linking
            const epDirName = `Ep ${padNumber(clip.episode.number)} ${clip.episode.title || 'Untitled'}`.trim();
            const episodeUserDir = path.join(target.userDir, epDirName);
            ensureDirSync(episodeUserDir);

            // Update Episode localMediaPath if empty
            if (!clip.episode.localMediaPath) {
                await prisma.episode.update({
                    where: { id: clip.episode.id },
                    data: { localMediaPath: episodeUserDir }
                });
                console.log(`      * Set Episode ${clip.episode.number} local path: ${episodeUserDir}`);
            }

            // 2. Download Cache File
            const cleanUrl = clip.resultUrl!.split(',')[0].trim();
            const filename = `${clip.id}_${Date.now()}.mp4`;
            const serverFilePath = path.join(SERVER_STORAGE_ROOT, filename);

            const success = await downloadMedia(cleanUrl, serverFilePath);
            if (!success) {
                totalSkipped++;
                continue;
            }

            // 3. Create Alias (Symlink)
            const safeTitle = (clip.title || 'Untitled').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
            const safeScene = (clip.scene || '').replace(/[^a-zA-Z0-9\.\s-]/g, '').trim();
            const baseSceneTitle = `${safeScene} ${safeTitle}`.trim() || 'Clip';

            let counter = 1;
            let targetUserFile = '';
            let resolvedPath = '';

            // Find unique filename and verify symlink integrity
            while (true) {
                const paddedCounter = counter.toString().padStart(2, '0');
                const uniqueFileName = `${baseSceneTitle} ${paddedCounter}.mp4`.trim();
                targetUserFile = path.join(episodeUserDir, uniqueFileName);

                if (!fs.existsSync(targetUserFile)) {
                    break;
                }

                try {
                    resolvedPath = fs.realpathSync(targetUserFile);
                    if (resolvedPath === serverFilePath) {
                        break;
                    }
                } catch (e) { /* link broken/missing */ }

                counter++;
            }

            try {
                if (!fs.existsSync(targetUserFile)) {
                    fs.symlinkSync(serverFilePath, targetUserFile, 'file');
                    console.log(`      ✓ Created Alias: ${targetUserFile}`);
                }
            } catch (err: any) {
                console.warn(`      ! Failed to create alias: ${err.message}`);
            }

            // 4. Update Clip Record
            const relativeServerUrl = `/media/clips/${filename}`;
            await prisma.clip.update({
                where: { id: clip.id },
                data: {
                    resultUrl: relativeServerUrl,
                    isPersisted: true,
                    status: ''
                }
            });
            console.log(`      ✓ DB Updated (Status cleared, UI Green)\n`);
            totalDownloaded++;
        }
    }

    console.log(`\n================================`);
    console.log(`[SUMMARY] Rescue Operation Complete`);
    console.log(`================================`);
    console.log(`Successfully Downloaded & Persisted: ${totalDownloaded}`);
    console.log(`Skipped/Failed: ${totalSkipped}`);
    console.log(`================================\n`);
}

function padNumber(num: number | null | undefined): string {
    if (num == null) return '01';
    return num.toString().padStart(2, '0');
}

main()
    .catch(e => {
        console.error('[FATAL ERROR]', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
