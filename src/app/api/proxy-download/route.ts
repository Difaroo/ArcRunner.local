import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    const rawFilename = request.nextUrl.searchParams.get('filename') || 'download.mp4';
    // Use path.basename to strip any directory components, then sanitize characters
    const safeBasename = path.basename(rawFilename);
    const filename = safeBasename.replace(/[^a-zA-Z0-9._\-\(\) \[\]]/g, '_');

    if (!url) return new NextResponse('Missing URL', { status: 400 });

    console.log(`[Proxy-DL] Request: URL=${url}, Filename=${filename}`);

    try {
        // OPTIMIZATION: If local file in /media, read directly from disk (STREAMED)
        if (url.startsWith('/media/') || url.startsWith('/uploads/')) {
            const localPath = path.join(process.cwd(), 'public', url);
            console.log(`[Proxy-DL] Resolving Local (Stream): ${localPath}`);

            if (fs.existsSync(localPath)) {
                const stat = fs.statSync(localPath);
                const fileSize = stat.size;

                // Determine Content Type
                const ext = path.extname(localPath).toLowerCase().replace('.', '');
                let contentType = 'application/octet-stream';
                if (ext === 'png') contentType = 'image/png';
                if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
                if (ext === 'mp4') contentType = 'video/mp4';
                if (ext === 'webp') contentType = 'image/webp';

                // Create Node Stream
                const fileStream = fs.createReadStream(localPath);

                // Convert Node Stream to Web ReadableStream for NextResponse
                const webStream = new ReadableStream({
                    start(controller) {
                        fileStream.on('data', (chunk) => controller.enqueue(chunk));
                        fileStream.on('end', () => controller.close());
                        fileStream.on('error', (err) => controller.error(err));
                    }
                });

                const headers = new Headers();
                headers.set('Content-Type', contentType);
                headers.set('Content-Disposition', `attachment; filename="${filename}"`);
                headers.set('Content-Length', fileSize.toString());

                return new NextResponse(webStream, { status: 200, headers });
            } else {
                console.error(`[Proxy-DL] File NOT FOUND at ${localPath}`);
                return new NextResponse(`File not found on server at ${localPath}`, { status: 404 });
            }
        }

        // ... Remote Fetch Fallback (STREAMED) ...
        let targetUrl = url;
        if (targetUrl.startsWith('/')) {
            targetUrl = `${request.nextUrl.origin}${targetUrl}`;
        }

        console.log(`[Proxy-DL] Fetching Remote (Stream): ${targetUrl}`);
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

        // Pass the fetch stream directly!
        return new NextResponse(response.body, { status: 200, headers: resHeaders });

    } catch (error: any) {
        console.error('Proxy Error:', error);
        return new NextResponse(`Internal Proxy Error: ${error.message}`, { status: 500 });
    }
}
