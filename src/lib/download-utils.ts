
import { Clip } from '@/app/api/clips/route';

/**
 * Generates the standard filename for a clip.
 * Format: "{Scene} - {Title} - v{Version}"
 */
export function getClipFilename(clip: Clip): string {
    const safeTitle = (clip.title || 'Untitled').replace(/[^a-z0-9 ]/gi, '').trim();
    const scene = (clip.scene || '0').trim();

    // Calculate Version from Status
    let ver = 1;
    const status = clip.status || '';
    if (status.startsWith('Saved')) {
        const match = status.match(/Saved \[(\d+)\]/);
        if (match) {
            ver = parseInt(match[1]) + 1;
        } else if (status === 'Saved') {
            ver = 2; // If it was already saved once, this is v2
        }
    }

    let filename = `${scene} ${safeTitle}`;
    if (ver > 1) {
        filename += ` ${ver.toString().padStart(2, '0')}`;
    }

    // Determine extension
    const ext = clip.resultUrl?.split('.').pop()?.split('?')[0] || 'mp4';
    if (!filename.endsWith(`.${ext}`)) {
        filename += `.${ext}`;
    }

    return filename;
}

/**
 * Downloads a file via Proxy to avoid CORS and force download dialog.
/**
 * Downloads a file, handling both Local (same-origin) and Remote (cross-origin) files modularly.
 * 
 * Strategy:
 * 1. If Local (starts with '/'): Use direct DOM link with `download` attribute. Browser handles this natively.
 * 2. If Remote: Use Proxy Route to fetch the file server-side and pipe it with Content-Disposition headers.
 */
export async function downloadFile(url: string, filename: string): Promise<boolean> {
    try {
        if (!url) {
            console.error('Download failed: No URL provided');
            return false;
        }

        // Handle CSV URLs (Take first)
        const effectiveUrl = url.split(',')[0].trim();
        if (!effectiveUrl) return false;

        // Sanitize filename
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

        // Check if Local
        const isLocal = effectiveUrl.startsWith('/') || effectiveUrl.startsWith(window.location.origin);

        if (isLocal) {
            console.log(`[Download] Handling Local File: ${effectiveUrl}`);

            // Direct Link Method for Same-Origin
            const a = document.createElement('a');
            a.href = effectiveUrl;
            a.download = safeFilename; // Browser respects this for same-origin
            a.style.display = 'none';
            document.body.appendChild(a);

            a.click();

            // Cleanup
            document.body.removeChild(a);
            return true;
        }

        // Remote (Cross-Origin) - Needs Proxy
        console.log(`[Download] Handling Remote File via Proxy: ${effectiveUrl}`);
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(effectiveUrl)}&filename=${encodeURIComponent(safeFilename)}`;

        const a = document.createElement('a');
        a.href = proxyUrl;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        // Cleanup with delay
        setTimeout(() => document.body.removeChild(a), 100);
        return true;

    } catch (error) {
        console.error('Download Helper Error:', error);
        alert(`Download failed: ${error}`);
        return false;
    }
}

/**
 * Helper to update clip status after save
 */
export function getNextStatus(currentStatus: string): string {
    let ver = 1;
    if (currentStatus && currentStatus.startsWith('Saved')) {
        const match = currentStatus.match(/Saved \[(\d+)\]/);
        if (match) {
            ver = parseInt(match[1]) + 1;
        } else if (currentStatus === 'Saved') {
            ver = 2;
        }
    }
    return ver > 1 ? `Saved [${ver}]` : 'Saved';
}
