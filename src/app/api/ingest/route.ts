import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, getHeaders, indexToColumnLetter } from '@/lib/sheets';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

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

        const sheets = await getGoogleSheetsClient();

        // --- 1. Process CLIPS ---
        if (clips.length > 0) {
            const headers = await getHeaders('CLIPS');
            const maxColIndex = Math.max(...Array.from(headers.values()));

            // Map JSON keys to Header Names
            const fieldToHeader: Record<string, string> = {
                scene: 'Scene #',
                status: 'Status',
                title: 'Title',
                character: 'Character',
                location: 'Location',
                style: 'Style',
                camera: 'Camera',
                action: 'Action',
                dialog: 'Dialog',
                refImageUrls: 'Ref Image URLs',
                refVideoUrl: 'Ref Video URL',
                seed: 'Seed',
                duration: 'DurationSec',
                quality: 'Quality',
                ratio: 'Ratio',
                negatives: 'Negatives',
                service: 'Service',
                episode: 'Episode',
                series: 'Series'
            };

            const clipRows = clips.map((clip: any) => {
                const row = new Array(maxColIndex + 1).fill('');

                // Fill mapped fields
                Object.entries(fieldToHeader).forEach(([field, header]) => {
                    const colIndex = headers.get(header);
                    if (colIndex !== undefined) {
                        // Handle special defaults or transforms
                        let value = clip[field] || '';
                        if (field === 'episode') value = episodeId;
                        if (field === 'service') value = 'kie_api';
                        if (field === 'quality' && !value) value = 'fast';
                        if (field === 'ratio' && !value) value = '9:16';

                        row[colIndex] = value;
                    }
                });

                return row;
            });

            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'CLIPS!A:ZZ', // Append to end, let Sheets figure out columns based on values
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: clipRows },
            });
        }

        // --- 2. Process LIBRARY ---
        if (library.length > 0) {
            const headers = await getHeaders('LIBRARY');
            const maxColIndex = Math.max(...Array.from(headers.values()));

            const fieldToHeader: Record<string, string> = {
                type: 'Type',
                name: 'Name',
                description: 'Description',
                refImageUrl: 'Ref Image URLs',
                negatives: 'Negatives',
                notes: 'Notes',
                episode: 'Episode',
                series: 'Series'
            };

            const libRows = library.map((item: any) => {
                const row = new Array(maxColIndex + 1).fill('');

                Object.entries(fieldToHeader).forEach(([field, header]) => {
                    const colIndex = headers.get(header);
                    if (colIndex !== undefined) {
                        let value = item[field] || '';
                        if (field === 'episode') value = episodeId;
                        row[colIndex] = value;
                    }
                });

                return row;
            });

            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'LIBRARY!A:ZZ',
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
