
import { Clip } from '@/types';

/**
 * Generates the standard filename for a clip.
 * Format: "{Scene} - {Title} - v{Version}"
 */
export function getClipFilename(clip: Clip, seriesTitle: string = 'Series'): string {
    // 1. Scene Number (e.g. "1.1")
    const sceneNum = (clip.scene || '').trim();

    // 2. Clip Name (Title)
    const clipName = (clip.title || 'Untitled').replace(/[^a-z0-9 \-_]/gi, '').trim();

    // 3. Version Logic
    // Format: " 2" (no "v"), empty for v1
    let ver = 1;
    const status = clip.status || '';
    if (status.startsWith('Saved')) {
        const match = status.match(/Saved \[(\d+)\]/);
        if (match) {
            ver = parseInt(match[1]);
        } else if (status === 'Saved') {
            ver = 1; // Assume base version
        }
    }

    // Construct Filename: "[SCENE NUMBER] [CLIP NAME] [VERSION]"
    // Example: "1.1 Roswell 2.png"
    let filenameParts: string[] = [];

    if (sceneNum) filenameParts.push(sceneNum);
    filenameParts.push(clipName);
    if (ver > 1) filenameParts.push(ver.toString());

    let filename = filenameParts.join(' ');

    // Determine extension
    const ext = clip.resultUrl?.split('.').pop()?.split('?')[0] || 'mp4';
    if (!filename.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
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
 *    OPTIMIZATION: Instead of fetching Blob in JS (which buffers and delays), we point the <a> tag
 *    directly to the Proxy URL. This allows the browser to stream the download immediately.
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

        // Ensure Extension
        let finalFilename = filename;
        const ext = effectiveUrl.split('.').pop()?.split('?')[0] || '';
        if (ext && !finalFilename.toLowerCase().endsWith('.' + ext.toLowerCase())) {
            finalFilename += `.${ext}`;
        }

        // Sanitize filename
        const safeFilename = finalFilename.replace(/[^a-zA-Z0-9._\-\(\) \[\]]/g, '_');

        // Check if Local (Same Origin or Relative)
        const isLocal = effectiveUrl.startsWith('/') || effectiveUrl.startsWith(window.location.origin);

        let downloadUrl = effectiveUrl;

        if (!isLocal) {
            // Remote (Cross-Origin) - Construct Proxy URL for direct navigation
            // This avoids the 5s delay of buffering the whole file into a Blob
            console.log(`[Download] Handling Remote File via Proxy (Stream): ${effectiveUrl} -> ${safeFilename}`);
            downloadUrl = `/api/proxy-download?url=${encodeURIComponent(effectiveUrl)}&filename=${encodeURIComponent(safeFilename)}`;
        } else {
            console.log(`[Download] Handling Local File: ${effectiveUrl} -> ${safeFilename}`);
        }

        // Trigger Download
        const a = document.createElement('a');
        a.href = downloadUrl;

        // Ensure 'download' attribute is set (Browser handles this for same-origin or explicit Content-Disposition)
        a.setAttribute('download', safeFilename);
        a.style.display = 'none';
        document.body.appendChild(a);

        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
        }, 100);

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
