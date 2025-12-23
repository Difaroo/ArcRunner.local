
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
export async function downloadFile(url: string, filename: string): Promise<boolean> {
    try {
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        return true;
    } catch (error) {
        console.error('Download Helper Error:', error);
        alert(`Failed to download ${filename}: ${error}`);
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
