
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
 * Returns true if successful.
 */
/**
 * Downloads a file via Proxy to avoid CORS and force download dialog.
 * OPTIMIZED: Uses direct link navigation to avoid loading file into Browser Memory (Blob).
 * This prevents crashes on mobile for large video files.
 */
export async function downloadFile(url: string, filename: string): Promise<boolean> {
    try {
        // Sanitize filename client-side for safety
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

        let targetUrl = url;
        // Construct Proxy URL if remote or needing headers
        // If it's already a local API route (e.g. /media/...), we might still want proxy to force Content-Disposition
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeFilename)}`;

        // Create invisible link and click it
        // This triggers the browser's download manager directly from the headers
        const a = document.createElement('a');
        a.href = proxyUrl;
        a.download = safeFilename; // Fallback attribute
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => document.body.removeChild(a), 100);
        return true;
    } catch (error) {
        console.error('Download Helper Error:', error);
        // Fallback to alert if something specifically regarding element creation fails
        // But actual network errors will be handled by browser download manager UI
        alert(`Download init failed: ${error}`);
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
