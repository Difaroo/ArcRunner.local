import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Define the target directory: ../Images relative to the web project root
        // process.cwd() is the 'web' directory
        const imagesDir = path.join(process.cwd(), '../Images');

        // Ensure directory exists
        if (!existsSync(imagesDir)) {
            await fs.mkdir(imagesDir, { recursive: true });
        }

        // Sanitize filename
        const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = path.join(imagesDir, sanitizedFilename);

        // Handle duplicates by appending a timestamp if needed, or just overwrite?
        // User didn't specify, but overwriting might be annoying if names clash. 
        // Let's append a timestamp if it exists to be safe, or just keep it simple for now.
        // Simple approach: if it exists, append timestamp.
        let finalFilename = sanitizedFilename;
        let finalPath = filePath;

        if (existsSync(finalPath)) {
            const nameParts = sanitizedFilename.split('.');
            const ext = nameParts.pop();
            const name = nameParts.join('.');
            finalFilename = `${name}_${Date.now()}.${ext}`;
            finalPath = path.join(imagesDir, finalFilename);
        }

        await fs.writeFile(finalPath, buffer);

        // Return the local URL
        // We will serve these via /api/images/[filename]
        const localUrl = `/api/images/${finalFilename}`;

        return NextResponse.json({ url: localUrl });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
