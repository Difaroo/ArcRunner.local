import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

// Root storage directory
const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'media');
const UPLOADS_DIR = path.join(STORAGE_ROOT, 'uploads');
const GENERATED_DIR = path.join(STORAGE_ROOT, 'generated');

// Ensure directories exist
const ensureDirs = async () => {
    try {
        if (!fs.existsSync(STORAGE_ROOT)) await mkdir(STORAGE_ROOT, { recursive: true });
        if (!fs.existsSync(UPLOADS_DIR)) await mkdir(UPLOADS_DIR, { recursive: true });
        if (!fs.existsSync(GENERATED_DIR)) await mkdir(GENERATED_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create storage directories:', error);
    }
};

// Initialize on import (safe for server-side)
ensureDirs();

export async function saveFile(buffer: Buffer, filename: string, type: 'upload' | 'generated'): Promise<string> {
    await ensureDirs();
    const targetDir = type === 'upload' ? UPLOADS_DIR : GENERATED_DIR;
    const filePath = path.join(targetDir, filename);
    await writeFile(filePath, buffer);
    const urlType = type === 'upload' ? 'uploads' : type;
    return `/api/media/${urlType}/${filename}`;
}

export async function getFilePath(urlPaths: string[]): Promise<string | null> {
    // urlPaths comes from [...path] slug: ['uploads', 'file.jpg']
    const safePath = path.join(STORAGE_ROOT, ...urlPaths);

    // Security check: Prevent directory traversal
    if (!safePath.startsWith(STORAGE_ROOT)) {
        return null;
    }

    try {
        await stat(safePath);
        return safePath;
    } catch {
        return null;
    }
}

export async function getFileContent(filePath: string): Promise<Buffer> {
    return await readFile(filePath);
}

import mime from 'mime';

export async function downloadAndSave(url: string, taskId: string, type: 'generated' | 'upload' = 'generated'): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);

        const contentType = res.headers.get('content-type') || 'application/octet-stream';
        const ext = mime.getExtension(contentType) || 'bin';

        // Clean taskId to be filename safe (allow spaces and dots)
        const safeId = taskId.replace(/[^a-zA-Z0-9-_\s.]/g, '').trim();
        const filename = `${safeId}.${ext}`;

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return await saveFile(buffer, filename, type);
    } catch (error) {
        console.error('Download and Save Error:', error);
        return null;
    }
}
