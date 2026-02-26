import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

/**
 * POST /api/media/open-folder
 * Opens Finder and highlights the specified file, or opens the episode edit folder.
 * 
 * Body: { localPath?: string, episodeId?: string }
 * - localPath: Direct path to reveal in Finder
 * - episodeId: Looks up episode.localMediaPath (edit folder) and opens that
 * Returns: { success: true }
 */
export async function POST(req: NextRequest) {
    try {
        const { localPath, episodeId } = await req.json();

        let targetPath = localPath;

        // If episodeId provided, look up the episode edit folder
        if (!targetPath && episodeId) {
            const episode = await db.episode.findUnique({
                where: { id: episodeId },
                select: { localMediaPath: true }
            });

            if (episode?.localMediaPath) {
                targetPath = episode.localMediaPath;
                console.log(`[OpenFolder] Resolved episode edit folder: ${targetPath}`);
            } else {
                return NextResponse.json({ error: 'No edit folder configured for this episode' }, { status: 404 });
            }
        }

        if (!targetPath || typeof targetPath !== 'string') {
            return NextResponse.json({ error: 'localPath or episodeId is required' }, { status: 400 });
        }

        const resolvedPath = path.resolve(targetPath);

        if (!fs.existsSync(resolvedPath)) {
            // If the file doesn't exist, try opening the parent directory
            const parentDir = path.dirname(resolvedPath);
            if (fs.existsSync(parentDir)) {
                exec(`open "${parentDir}"`);
                console.log(`[OpenFolder] File not found, opened parent: ${parentDir}`);
                return NextResponse.json({ success: true, note: 'Opened parent directory' });
            }
            return NextResponse.json({ error: 'Path not found' }, { status: 404 });
        }

        // macOS: open -R reveals the file in Finder, open (without -R) opens a folder
        const isDirectory = fs.statSync(resolvedPath).isDirectory();
        const command = isDirectory ? `open "${resolvedPath}"` : `open -R "${resolvedPath}"`;

        exec(command, (error) => {
            if (error) {
                console.error(`[OpenFolder] exec error: ${error.message}`);
            }
        });

        console.log(`[OpenFolder] ${isDirectory ? 'Opened' : 'Revealing'}: ${resolvedPath}`);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[OpenFolder] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
