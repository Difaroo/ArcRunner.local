
import { google } from 'googleapis';

/**
 * Returns an authenticated Google Drive client (service account).
 */
export async function getDriveClient(version: 'v3' = 'v3') {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file'],
    });
    return google.drive({ version, auth });
}

/**
 * Converts various Google Drive URL formats to a direct download link
 * suitable for consumption by external APIs (like Kie.ai).
 * Returns empty string if invalid or local.
 */
export const convertDriveUrl = (url: string): string => {
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
        // Return standard export link
        return `https://drive.google.com/uc?export=download&id=${id}`;
    }

    // 4. Fallback: If it's a valid absolute HTTP URL, allow it (e.g. public web image)
    if (url.startsWith('http')) return url;

    // 5. Allow local URLs
    if (url.startsWith('/api/')) return url;

    // 6. Reject other relative/local URLs
    console.warn(`[convertDriveUrl] Skipping invalid/local URL: ${url}`);
    return '';
};
