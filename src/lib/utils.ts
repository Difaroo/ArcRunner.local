import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Converts various Google Drive URL formats to a direct download link.
 * Used for proxying image requests or standardizing inputs.
 */
export const convertDriveUrl = (url: string | null | undefined): string => {
    if (!url) return '';

    // 1. Already a direct Google User Content link or Export link
    if (url.includes('googleusercontent.com') || url.includes('export=download')) return url;

    let id = '';

    // 2. Pattern: /file/d/ID
    const matchFile = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFile) id = matchFile[1];

    // 3. Pattern: id=ID (e.g. open?id=, uc?id=)
    if (!id) {
        const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (matchId) id = matchId[1];
    }

    if (id) {
        return `https://drive.google.com/uc?export=download&id=${id}`;
    }

    // 4. Fallback: If it's a valid absolute HTTP URL, allow it
    if (url.startsWith('http')) return url;

    // 5. Allow local URLs
    if (url.startsWith('/api/')) return url;

    return '';
};

/**
 * Normalizes a URL for robust comparison.
 * Strips origin (host/protocol) and returns just the pathname.
 * Handles both absolute and relative URLs.
 */
export const normalizeUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    try {
        // If it's already relative/path, return it trimmed
        if (url.startsWith('/')) {
            const parts = url.split('?'); // strip query if present
            return parts[0].trim();
        }
        // If absolute, parse and return pathname
        const urlObj = new URL(url);
        return urlObj.pathname.trim();
    } catch {
        // Fallback for weird formats - split query manually if full URL parse fails
        return url.split('?')[0].trim();
    }
};
