import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    const rawFilename = request.nextUrl.searchParams.get('filename') || 'download.mp4';
    const filename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (!url) return new NextResponse('Missing URL', { status: 400 });

    console.log(`[Proxy-DL] Request: URL=${url}, Filename=${filename}`);

    try {
        // OPTIMIZATION: If local file in /media, read directly from disk
        if (url.startsWith('/media/') || url.startsWith('/uploads/')) {
            const localPath = path.join(process.cwd(), 'public', url);
            console.log(`[Proxy-DL] Resolving Local: ${localPath}`);

            if (fs.existsSync(localPath)) {
                // Determine Content Type
                const ext = path.extname(localPath).toLowerCase().replace('.', '');
                // Map common types...
                let contentType = 'application/octet-stream';
                if (ext === 'png') contentType = 'image/png';
                if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
                if (ext === 'mp4') contentType = 'video/mp4';
                if (ext === 'webp') contentType = 'image/webp';

                const fileBuffer = fs.readFileSync(localPath);

                const headers = new Headers();
                headers.set('Content-Type', contentType);
                headers.set('Content-Disposition', `attachment; filename="${filename}"`);
                headers.set('Content-Length', fileBuffer.length.toString());

                return new NextResponse(new Uint8Array(fileBuffer), { status: 200, headers });
            } else {
                console.error(`[Proxy-DL] File NOT FOUND at ${localPath}`);
                return new NextResponse(`File not found on server at ${localPath}`, { status: 404 });
            }
        }

        // ... Remote Fetch Fallback ...
        let targetUrl = url;
        if (targetUrl.startsWith('/')) {
            targetUrl = `${request.nextUrl.origin}${targetUrl}`;
        }

        console.log(`[Proxy-DL] Fetching Remote: ${targetUrl}`);
        const response = await fetch(targetUrl);

        if (!response.ok) {
            console.error(`[Proxy-DL] Remote Fetch Failed: ${response.status} ${response.statusText}`);
            return new NextResponse(`Failed to fetch remote file: ${response.statusText}`, { status: response.status });
        }

        const resHeaders = new Headers();
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        resHeaders.set('Content-Type', contentType);
        resHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
        if (response.headers.get('content-length')) resHeaders.set('Content-Length', response.headers.get('content-length')!);

        // Read remote body to buffer to ensure completion before sending? 
        // Or stream. Let's strictly buffer for now to isolate issues.
        const blob = await response.arrayBuffer();

        return new NextResponse(new Uint8Array(blob), { status: 200, headers: resHeaders });

    } catch (error: any) {
        console.error('Proxy Error:', error);
        return new NextResponse(`Internal Proxy Error: ${error.message}`, { status: 500 });
    }
}
