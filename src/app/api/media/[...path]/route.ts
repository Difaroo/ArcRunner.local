import { NextRequest, NextResponse } from 'next/server';
import { getFilePath, getFileContent } from '@/lib/storage';
import mime from 'mime'; // Need to check if 'mime' package is available or write simple map

// Simple mime map fallback if package not present (likely not in deps)
const getMimeType = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'webp': return 'image/webp';
        case 'gif': return 'image/gif';
        case 'mp4': return 'video/mp4';
        case 'mov': return 'video/quicktime';
        case 'json': return 'application/json';
        default: return 'application/octet-stream';
    }
};

export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    try {
        const pathSegments = params.path; // e.g. ['uploads', 'image.jpg']

        if (!pathSegments || pathSegments.length === 0) {
            return new NextResponse('Not Found', { status: 404 });
        }

        const filePath = await getFilePath(pathSegments);

        if (!filePath) {
            return new NextResponse('File Not Found', { status: 404 });
        }

        const fileBuffer = await getFileContent(filePath);
        const filename = pathSegments[pathSegments.length - 1];
        const contentType = getMimeType(filename);

        return new NextResponse(fileBuffer as any, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });

    } catch (error) {
        console.error('Serve Media Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
