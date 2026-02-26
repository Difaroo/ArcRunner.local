import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/media/delete-local
 * Deletes a local file from disk. Used by UVM trashcan for housekeeping.
 * 
 * Body: { localPath: string }
 * Returns: { success: true, deleted: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { localPath } = await req.json();

        if (!localPath || typeof localPath !== 'string') {
            return NextResponse.json({ error: 'localPath is required' }, { status: 400 });
        }

        // Security: Only allow deletion within known media directories
        const resolvedPath = path.resolve(localPath);
        const allowedPrefixes = [
            path.resolve(process.cwd(), 'public'),
            path.resolve(process.cwd(), 'media'),
            path.resolve(process.cwd(), 'uploads'),
        ];

        // Also allow absolute paths under the user's home directory media folders
        const homeDir = process.env.HOME || '/Users';
        allowedPrefixes.push(path.resolve(homeDir, 'Documents'));
        allowedPrefixes.push(path.resolve(homeDir, 'Movies'));

        const isAllowed = allowedPrefixes.some(prefix => resolvedPath.startsWith(prefix));
        if (!isAllowed) {
            console.warn(`[DeleteLocal] Blocked deletion outside allowed paths: ${resolvedPath}`);
            return NextResponse.json({ error: 'Path not allowed' }, { status: 403 });
        }

        if (!fs.existsSync(resolvedPath)) {
            console.warn(`[DeleteLocal] File not found: ${resolvedPath}`);
            return NextResponse.json({ success: true, deleted: resolvedPath, note: 'File already absent' });
        }

        fs.unlinkSync(resolvedPath);
        console.log(`[DeleteLocal] Deleted: ${resolvedPath}`);

        return NextResponse.json({ success: true, deleted: resolvedPath });
    } catch (e: any) {
        console.error('[DeleteLocal] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
