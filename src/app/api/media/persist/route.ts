import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import stream from 'stream';
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

        // LOGGING: Debug Write Failure
        logPersist(`[Persistence] Starting download...`);
        logPersist(`[Persistence] Source URL: ${clip.resultUrl}`);
        logPersist(`[Persistence] Target Server Path: ${serverFilePath}`);

        const response = await fetch(clip.resultUrl);
        if (!response.ok) {
            const err = `Failed to fetch media: ${response.statusText} (${clip.resultUrl})`;
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

            body.on('error', (err) => {
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
        // Filename: "{Scene} {Title}.mp4" (User friendly)
        const safeTitle = (clip.title || 'Untitled').replace(/[^a-z0-9]/gi, '_');
        const safeScene = (clip.scene || '').replace(/[^a-z0-9]/gi, '_');
        let userFilename = `${safeScene}_${safeTitle}.mp4`.trim();

        // Defensive: Handle Collisions
        // If file exists, check if it's our symlink or a user file.
        // If it sends to same server file, no op.
        // If different server file, or user file -> Version it.

        let userFilePath = path.join(targetUserFolder!, userFilename);
        let counter = 1;

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
                        // Points to different file -> Overwrite (Update) or Version? 
                        // If it's the SAME Clip but different generation, we probably want to update the link?
                        // But user might want history.
                        // Decision: Version it to be safe.
                    }
                }
            } catch (e) { } // Ignore error, proceed to versioning

            // Create Version: "Scene_Title_v1.mp4"
            const ext = path.extname(userFilename);
            const base = path.basename(userFilename, ext);
            // Check if already has version
            const match = base.match(/^(.*)_v(\d+)$/);
            if (match) {
                userFilename = `${match[1]}_v${parseInt(match[2]) + 1}${ext}`;
            } else {
                userFilename = `${base}_v${counter}${ext}`;
            }
            userFilePath = path.join(targetUserFolder!, userFilename);
            counter++;
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
