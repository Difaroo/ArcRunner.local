import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import stream, { Readable } from 'stream';
import { exec } from 'child_process';

const pipeline = promisify(stream.pipeline);
const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Configuration
// Changed to 'public/media/clips' per user architectural decision (v0.32)
const SERVER_STORAGE_ROOT = path.join(process.cwd(), 'public', 'media', 'clips');

// Debug Logger
const logPersist = (msg: string) => {
    const logPath = path.join(process.cwd(), 'persistence.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
    console.log(msg);
};

// Ensure server storage exists
if (!fs.existsSync(SERVER_STORAGE_ROOT)) {
    fs.mkdirSync(SERVER_STORAGE_ROOT, { recursive: true });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clipId, episodeId, customPath } = body;

        logPersist(`[Persistence] Request received. Body: ${JSON.stringify(body)}`);

        if (!clipId || !episodeId) {
            logPersist(`[Persistence] REJECTED: Missing required fields. clipId=${clipId}, episodeId=${episodeId}`);
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        console.log(`[Persistence] Starting for Clip ${clipId} in Ep ${episodeId}`);

        // 1. Get Clip & Episode Data
        // Fix: Parse clipId to Int (Schema uses Int, Frontend uses String)
        const clipIdInt = parseInt(String(clipId));
        if (isNaN(clipIdInt)) {
            return NextResponse.json({ error: 'Invalid Clip ID' }, { status: 400 });
        }

        const clip = await prisma.clip.findUnique({
            where: { id: clipIdInt },
            include: { episode: true }
        });

        if (!clip || !clip.resultUrl) {
            return NextResponse.json({ error: 'Clip or Result URL not found' }, { status: 404 });
        }

        // 2. Determine User Folder Path (Episode.localMediaPath)
        let targetUserFolder = clip.episode.localMediaPath;

        // If not set, check if customPath was provided (First Save)
        if (!targetUserFolder && customPath) {
            // Validate Path Exists
            if (!fs.existsSync(customPath)) {
                return NextResponse.json({ error: 'Provided path does not exist' }, { status: 400 });
            }
            // Update Episode Record
            await prisma.episode.update({
                where: { id: episodeId },
                data: { localMediaPath: customPath }
            });
            targetUserFolder = customPath;
            console.log(`[Persistence] Set Episode ${episodeId} local path to: ${customPath}`);
        } else if (!targetUserFolder) {
            return NextResponse.json({ error: 'No persistence path configured for this episode' }, { status: 400 });
        }

        // 3. Download to Server Storage (Primary Cache)
        // Filename: {clipId}_{timestamp}.mp4        // 3. Download File (Stream)
        // Use consolidated public/media/clips location
        // Ensure directory exists first (should be handled by storage.ts but let's be safe)
        if (!fs.existsSync(SERVER_STORAGE_ROOT)) {
            fs.mkdirSync(SERVER_STORAGE_ROOT, { recursive: true });
        }

        const filename = `${clip.id}_${Date.now()}.mp4`;
        const serverFilePath = path.join(SERVER_STORAGE_ROOT, filename);

        // Extract clean URL (handle comma separated errors or multiple urls)
        const cleanUrl = clip.resultUrl.split(',')[0].trim();

        // LOGGING: Debug Write Failure
        logPersist(`[Persistence] Starting download...`);
        logPersist(`[Persistence] Source URL: ${cleanUrl} (from original: ${clip.resultUrl})`);
        logPersist(`[Persistence] Target Server Path: ${serverFilePath}`);

        const response = await fetch(cleanUrl);
        if (!response.ok) {
            const err = `Failed to fetch media: ${response.statusText} (${cleanUrl})`;
            logPersist(err);
            throw new Error(err);
        }
        if (!response.body) {
            const err = `No response body for media: ${clip.resultUrl}`;
            logPersist(err);
            throw new Error(err);
        }

        const fileStream = fs.createWriteStream(serverFilePath);

        await new Promise((resolve, reject) => {
            // @ts-ignore - ReadableStream/NodeStream mismatch
            const body = Readable.fromWeb(response.body as any);

            body.pipe(fileStream);

            body.on('error', (err: any) => {
                logPersist(`[Persistence] Read Stream Error: ${err}`);
                reject(err);
            });

            fileStream.on('finish', () => {
                logPersist(`[Persistence] Write Finished: ${serverFilePath}`);
                resolve(null);
            });

            fileStream.on('error', (err) => {
                logPersist(`[Persistence] Write Stream Error: ${err}`);
                reject(err);
            });
        });

        // Verify File Size
        const stat = fs.statSync(serverFilePath);
        logPersist(`[Persistence] File saved. Size: ${stat.size} bytes`);

        if (stat.size === 0) {
            logPersist('[Persistence] WARNING: Saved file is 0 bytes.');
        }

        // 4. Create Alias (Symlink) in User Folder
        // Filename: "[SCN NUMBER] [CLIP TITLE] [VERSION]"
        // Sanitize but preserve spaces
        const safeTitle = (clip.title || 'Untitled').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
        const safeScene = (clip.scene || '').replace(/[^a-zA-Z0-9\.\s-]/g, '').trim();
        const baseSceneTitle = `${safeScene} ${safeTitle}`.trim() || 'Clip';

        let counter = 1;
        let userFilename = `${baseSceneTitle} ${counter.toString().padStart(2, '0')}.mp4`;
        let userFilePath = path.join(targetUserFolder!, userFilename);

        while (fs.existsSync(userFilePath)) {
            // Check if it's a symlink
            try {
                const stats = fs.lstatSync(userFilePath);
                if (stats.isSymbolicLink()) {
                    const target = fs.readlinkSync(userFilePath);
                    if (target === serverFilePath) {
                        console.log(`[Persistence] Symlink already exists and points to correct file.`);
                        break; // All good
                    } else {
                        // Points to different file -> Version it.
                    }
                }
            } catch (e) { } // Ignore error, proceed to versioning

            // Create Version: "Scene Title 02.mp4"
            counter++;
            userFilename = `${baseSceneTitle} ${counter.toString().padStart(2, '0')}.mp4`;
            userFilePath = path.join(targetUserFolder!, userFilename);
        }

        if (!fs.existsSync(userFilePath)) {
            try {
                fs.symlinkSync(serverFilePath, userFilePath);
                console.log(`[Persistence] Alias created successfully at: ${userFilePath}`);
            } catch (err) {
                console.error('[Persistence] Symlink creation failed:', err);
                // Fallback: Copy file if symlink fails (e.g. cross-volume permissions)
                try {
                    fs.copyFileSync(serverFilePath, userFilePath);
                    console.log(`[Persistence] Fallback: Copied file to: ${userFilePath}`);
                } catch (copyErr) {
                    console.error('[Persistence] Copy fallback failed:', copyErr);
                    // Non-critical failure (server copy exists), but worth noting
                }
            }
        } else {
            console.log(`[Persistence] File already exists at user path: ${userFilePath}`);
        }

        // 5. Update Clip Record
        await prisma.clip.update({
            where: { id: clipIdInt },
            data: {
                isPersisted: true,
                status: '', // Clear traffic light status (Red->Orange->Green->Clear)
                // We could store the server path in a Media relation here
            }
        });

        // Also create/update Media record for future proofing
        await prisma.media.create({
            data: {
                url: `/api/storage/${filename}`, // Local proxy URL
                localPath: serverFilePath,
                type: 'VIDEO',
                category: 'RESULT',
                resultForClipId: clip.id,
                episodeId: episodeId
            }
        });

        return NextResponse.json({ success: true, localPath: serverFilePath, aliasPath: userFilePath });

    } catch (error) {
        console.error('[Persistence] Error:', error);
        return NextResponse.json({ error: 'Persistence failed' }, { status: 500 });
    }
}
