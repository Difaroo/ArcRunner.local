import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// --- Config ---
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

// --- Helper: Get Auth Client ---
const getAuthClient = async () => {
    if (!CLIENT_EMAIL || !PRIVATE_KEY) {
        throw new Error('Missing Google Service Account credentials');
    }
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: CLIENT_EMAIL,
            private_key: PRIVATE_KEY,
        },
        scopes: SCOPES,
    });
    return await auth.getClient();
};

export async function POST(request: Request) {
    try {
        const { json, episodeId } = await request.json();

        if (!json || !episodeId) {
            return NextResponse.json({ error: 'Missing json or episodeId' }, { status: 400 });
        }

        let payload;
        try {
            payload = JSON.parse(json);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
        }

        // Support both: Array (Clips only) OR Object { clips: [], library: [] }
        const clips = Array.isArray(payload) ? payload : (payload.clips || []);
        const library = Array.isArray(payload) ? [] : (payload.library || []);

        const authClient = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient as any });

        // 1. Process CLIPS
        if (clips.length > 0) {
            // Map clip objects to sheet rows (Columns A-Z)
            // Order must match the Sheet columns exactly
            // A: Scene, B: Status, C: Title, D: Character, E: Desc, F: Location, G: Style, H: Camera, I: Action, J: Dialog, K: RefImages... Z: Episode
            const clipRows = clips.map((clip: any) => {
                const row = new Array(26).fill(''); // A-Z

                row[0] = clip.scene || '';       // A: Scene
                row[1] = '';                     // B: Status (Empty)
                row[2] = clip.title || '';       // C: Title
                row[3] = clip.character || '';   // D: Character
                row[4] = '';                     // E: Pick Character (Unused)
                row[5] = clip.location || '';    // F: Location
                row[6] = clip.style || '';       // G: Style
                row[7] = clip.camera || '';      // H: Camera
                row[8] = clip.action || '';      // I: Action
                row[9] = clip.dialog || '';      // J: Dialog
                row[10] = clip.refImageUrls || ''; // K: Ref Image URLs
                row[11] = clip.refVideoUrl || '';  // L: Ref Video URL
                row[12] = clip.seed || '';         // M: Seed
                row[13] = clip.duration || '';     // N: DurationSec
                row[14] = clip.quality || 'fast';  // O: Quality
                row[15] = clip.ratio || '9:16';    // P: Ratio
                row[16] = clip.negatives || '';    // Q: Negatives
                row[17] = '';                      // R: Prompt (Empty)
                row[18] = '';                      // S: Result URL (Empty)
                row[19] = '';                      // T: Log (Empty)
                row[20] = 'kie_api';               // U: Service
                // V-Y Unused
                row[25] = episodeId;             // Z: Episode (Index 25)

                return row;
            });

            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'CLIPS!A:Z',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: clipRows },
            });
        }

        // 2. Process LIBRARY
        if (library.length > 0) {
            // Map library objects to sheet rows (Columns A-G)
            // A: Type, B: Name, C: Description, D: RefImage, E: Negatives, F: Notes, G: Episode
            const libRows = library.map((item: any) => {
                const row = new Array(7).fill('');
                row[0] = item.type || '';
                row[1] = item.name || '';
                row[2] = item.description || '';
                row[3] = item.refImageUrl || '';
                row[4] = item.negatives || '';
                row[5] = item.notes || '';
                row[6] = episodeId; // G: Episode
                return row;
            });

            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'LIBRARY!A:G',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: libRows },
            });
        }

        return NextResponse.json({
            success: true,
            clipsCount: clips.length,
            libraryCount: library.length
        });

    } catch (error: any) {
        console.error('Ingest Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
