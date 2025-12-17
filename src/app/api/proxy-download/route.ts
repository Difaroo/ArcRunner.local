import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    const filename = request.nextUrl.searchParams.get('filename') || 'download.mp4';

    if (!url) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    try {
        let targetUrl = url;
        if (targetUrl.startsWith('/')) {
            targetUrl = `${request.nextUrl.origin}${targetUrl}`;
        }

        // Forward Range header if present
        const range = request.headers.get('range');
        const headers: HeadersInit = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
        if (range) {
            headers['Range'] = range;
        }

        const response = await fetch(targetUrl, { headers });

        if (!response.ok) {
            // Forward error status
            return new NextResponse(`Failed to fetch file: ${response.statusText}`, { status: response.status });
        }

        // Prepare response headers
        const resHeaders = new Headers();
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        resHeaders.set('Content-Type', contentType);
        resHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
        resHeaders.set('Cache-Control', 'no-cache');

        // Forward Critical Streaming Headers
        const contentLength = response.headers.get('content-length');
        if (contentLength) resHeaders.set('Content-Length', contentLength);

        const contentRange = response.headers.get('content-range');
        if (contentRange) resHeaders.set('Content-Range', contentRange);

        const acceptRanges = response.headers.get('accept-ranges');
        if (acceptRanges) resHeaders.set('Accept-Ranges', acceptRanges);

        // Return Stream
        return new NextResponse(response.body, {
            status: response.status,
            headers: resHeaders
        });

    } catch (error) {
        console.error('Error proxying download:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
