/**
 * scripts/offline-persist.ts
 * 
 * "Reverse Persistence" script. Scans a local folder containing pre-downloaded
 * generation `.mp4` files, matches them to Clip database records via filename heuristics
 * (Scene + Title), copies them into the central server cache, creates organized Symlink Aliases,
 * and formally sets them to `isPersisted = true` in the Prod database.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();
const SERVER_STORAGE_ROOT = path.join(process.cwd(), 'public', 'media', 'clips');

// Helper: Safely create directory
function ensureDirSync(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Ensure server storage exists
ensureDirSync(SERVER_STORAGE_ROOT);

function normalizeString(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function processSeriesMatch(seriesId: string, seriesTitle: string, userSourceDirs: string[]) {
    console.log(`\n=========================================`);
    console.log(`[SERIES] Scanning: ${seriesTitle}`);
    console.log(`=========================================`);

    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const userSourceDir of userSourceDirs) {
        console.log(`\n -> [SOURCE DIR] ${userSourceDir}`);
        if (!fs.existsSync(userSourceDir)) {
            console.error(`    [ERROR] Source directory does not exist: ${userSourceDir}`);
            continue;
        }

        // 1. Read all local mp4 files in the directory
        const files = fs.readdirSync(userSourceDir)
            .filter(f => f.toLowerCase().endsWith('.mp4') || f.toLowerCase().endsWith('.webm'));

        if (files.length === 0) {
            console.log(`    [INFO] No video files found in ${userSourceDir}`);
            continue;
        }

        // 2. Fetch all completed clips for this series
        const clips = await prisma.clip.findMany({
            where: {
                episode: { seriesId: seriesId },
                status: 'Done'
            },
            include: { episode: true }
        });

        let successCount = 0;
        let failedMatchCount = 0;
        let skippedPersistedCount = 0;

        for (const file of files) {
            const filePath = path.join(userSourceDir, file);

            // Skip files that are already symlinks (we likely created them previously)
            if (fs.lstatSync(filePath).isSymbolicLink()) {
                console.log(`   [SKIP] ${file} is already a symlink.`);
                totalSkipped++;
                continue;
            }

            // 3. Heuristic Matching
            // Expected format variants: "1.1 The Arrival 01.mp4" or "1.1 - The Arrival.mp4"
            const cleanName = file.replace(/\.[^/.]+$/, ""); // strip extension
            const normalizedFile = normalizeString(cleanName);

            let matchedClip = null;

            for (const clip of clips) {
                const sceneStr = clip.scene || '';
                const titleStr = clip.title || '';

                // Core matching criteria: The filename must contain both the exact Scene number
                // and the Title (ignoring cases/special characters).
                const normScene = normalizeString(sceneStr);
                const normTitle = normalizeString(titleStr);

                // Direct strict match mapping
                if (normScene && normTitle && normalizedFile.includes(normScene) && normalizedFile.includes(normTitle)) {
                    matchedClip = clip;
                    break;
                }
            }

            if (!matchedClip) {
                console.warn(`   [FAIL] Could not database-match local file: "${file}"`);
                totalFailed++;
                continue;
            }

            if (matchedClip.isPersisted && matchedClip.resultUrl?.includes('/media/clips/')) {
                console.log(`   [SKIP] ${file} -> Matched Clip [${matchedClip.scene}] ${matchedClip.title} is already persisted natively.`);
                totalSkipped++;
                continue;
            }

            console.log(`   [MATCH] ${file} -> Clip [${matchedClip.scene}] ${matchedClip.title} (ID: ${matchedClip.id})`);

            // 4. Persistence Architecture Execution
            try {
                // A. Update Episode localMediaPath if empty
                if (!matchedClip.episode.localMediaPath) {
                    await prisma.episode.update({
                        where: { id: matchedClip.episode.id },
                        data: { localMediaPath: userSourceDir } // Map the whole series alias path here
                    });
                    console.log(`      * Set Episode ${matchedClip.episode.number} local path: ${userSourceDir}`);
                    matchedClip.episode.localMediaPath = userSourceDir; // update local ref
                }

                // B. Copy File to Central Cache (Safer than moving)
                const serverFilename = `${matchedClip.id}_${Date.now()}${path.extname(file)}`;
                const serverFilePath = path.join(SERVER_STORAGE_ROOT, serverFilename);
                fs.copyFileSync(filePath, serverFilePath);

                // C. Create clean Alias Symlink
                const safeTitle = (matchedClip.title || 'Untitled').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
                const safeScene = (matchedClip.scene || '').replace(/[^a-zA-Z0-9\.\s-]/g, '').trim();
                const baseSceneTitle = `${safeScene} ${safeTitle}`.trim() || 'Clip';

                let counter = 1;
                let targetAliasFile = '';

                while (true) {
                    const paddedCounter = counter.toString().padStart(2, '0');
                    const uniqueFileName = `${baseSceneTitle} ${paddedCounter}.mp4`.trim();
                    targetAliasFile = path.join(userSourceDir, uniqueFileName);

                    if (!fs.existsSync(targetAliasFile)) {
                        break;
                    }
                    counter++;
                }

                fs.symlinkSync(serverFilePath, targetAliasFile, 'file');
                console.log(`      ✓ Created Alias: ${targetAliasFile}`);

                // D. Database Routing Update
                const relativeServerUrl = `/media/clips/${serverFilename}`;

                await prisma.clip.update({
                    where: { id: matchedClip.id },
                    data: {
                        resultUrl: relativeServerUrl,
                        isPersisted: true,
                        status: ''
                    }
                });

                // Create a fresh RESULT Media record to point to local path too.
                // This natively supports multiple UI media slots if multiple local files match.
                await prisma.media.create({
                    data: {
                        id: crypto.randomUUID(),
                        url: relativeServerUrl,
                        type: 'VIDEO',
                        category: 'RESULT',
                        resultForClipId: matchedClip.id,
                        episodeId: matchedClip.episode.id,
                        localPath: targetAliasFile,
                        createdAt: new Date()
                    }
                });

                console.log(`      ✓ UI Link Updated & Greenlit`);
                totalSuccess++;

            } catch (err: any) {
                console.error(`      [ERROR] Failed to persist ${file}: ${err.message}`);
                totalFailed++;
            }
        }
    }

    return { success: totalSuccess, failed: totalFailed, skipped: totalSkipped };
}

async function main() {
    console.log(`🚀 Starting Offline Local DB Audio/Video Matching...\n`);

    // User predefined paths
    const TARGETS = [
        {
            seriesId: "2",
            seriesTitle: "UFO Invasion",
            userDirs: [
                "/Users/davidfennell/Library/CloudStorage/GoogleDrive-difaroo@gmail.com/Other computers/DIF MacBook Pro/~ LIVE/~ CROWDSTATE/UFO INVASION/TRAILER/VIDEO clips"
            ]
        },
        {
            seriesId: "ac28ec95-63ea-47ee-a190-19253dd939b1",
            seriesTitle: "Rise of the Witches",
            userDirs: [
                "/Users/davidfennell/Documents/~ JOBS current/Rise of the Witches/~ PILOT/CLIPS final/Scene 01",
                "/Users/davidfennell/Documents/~ JOBS current/Rise of the Witches/~ PILOT/CLIPS final/Scene 02",
                "/Users/davidfennell/Documents/~ JOBS current/Rise of the Witches/~ PILOT/CLIPS final/Scene 03"
            ]
        }
    ];

    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const target of TARGETS) {
        const stats = await processSeriesMatch(target.seriesId, target.seriesTitle, target.userDirs);
        totalSuccess += stats.success;
        totalFailed += stats.failed;
        totalSkipped += stats.skipped;
    }

    console.log(`\n================================`);
    console.log(`[SUMMARY] Offline Import Complete`);
    console.log(`================================`);
    console.log(`Successfully Matched & Persisted: ${totalSuccess}`);
    console.log(`Unmatched / Failed:               ${totalFailed}`);
    console.log(`Skipped (Already Linked):         ${totalSkipped}`);
    console.log(`================================\n`);
    console.log(`📌 NOTE: Original MP4s are still in your folders alongside the NEW Alias files.`);
    console.log(`You may safely delete the original MP4s, leaving the generated symlink aliases intact.`);
}

main()
    .catch(e => {
        console.error('[FATAL ERROR]', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
