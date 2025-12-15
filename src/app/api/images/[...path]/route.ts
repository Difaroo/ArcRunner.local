import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import mime from 'mime';

export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    try {
        // The path parameter is an array of path segments
        const filename = params.path.join('/');

        // Security check: prevent directory traversal
        if (filename.includes('..')) {
            return new NextResponse('Invalid path', { status: 400 });
        }

        // Define the target directory: Use the shared storage location
        const imagesDir = path.join(process.cwd(), 'storage/media/uploads');
        // Handle legacy path structure where filename might include 'uploads/' prefix or not
        // Current filename from params is just the slug e.g. "Candy_Arlene..."
        // But if the URL was /api/images/uploads/foo.jpg, filename is 'uploads/foo.jpg'.
        // We safely join.
        const filePath = path.join(imagesDir, filename);

        if (!existsSync(filePath)) {
            return new NextResponse('File not found', { status: 404 });
        }

        const fileBuffer = await fs.readFile(filePath);

        // Determine content type
        const contentType = mime.getType(filePath) || 'application/octet-stream';

        return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });

    } catch (error: any) {
        console.error('Serve image error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
