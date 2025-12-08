import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, getHeaders, indexToColumnLetter } from '@/lib/sheets';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

export async function POST(request: Request) {
    try {
        const { json, episodeId, seriesId, defaultModel } = await request.json();

        if (!json || !episodeId || !seriesId) {
            return NextResponse.json({ error: 'Missing json, episodeId, or seriesId' }, { status: 400 });
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

        console.log('Ingest Payload:', {
            isArray: Array.isArray(payload),
            keys: Object.keys(payload),
            clipsCount: clips.length,
            libCount: library.length,
            seriesId
        });

        const sheets = await getGoogleSheetsClient();

        // --- 1. Process CLIPS ---
        if (clips.length > 0) {
            const headers = await getHeaders('CLIPS');
            const maxColIndex = Math.max(...Array.from(headers.values()));

            // Debug Validation
            if (!headers.has('Series')) throw new Error("Missing 'Series' column in CLIPS sheet");
            if (!headers.has('Episode')) throw new Error("Missing 'Episode' column in CLIPS sheet");

            // Map JSON keys to Header Names
            const fieldToHeader: Record<string, string> = {
                scene: 'Scene #',
                status: 'Status',
                title: 'Title',
                character: 'Characters',
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
                series: 'Series',
                model: 'Model'
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
                        if (field === 'series') value = seriesId;
                        if (field === 'service') value = 'kie_api';
                        if (field === 'quality' && !value) value = 'fast';
                        if (field === 'ratio' && !value) value = '9:16';
                        if (field === 'ratio' && !value) value = '9:16';
                        // if (field === 'model' && !value && defaultModel) value = defaultModel; // Removed per user request

                        row[colIndex] = value;
                    }
                });

                return row;
            });

            console.log(`Appending ${clipRows.length} rows to CLIPS...`);
            const appendRes = await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'CLIPS!A:ZZ',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: clipRows },
            });
            console.log('Clips Append Result:', appendRes.data);
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

                // Pre-process aliases
                item['description'] = item['description'] || item['prompt'] || '';

                Object.entries(fieldToHeader).forEach(([field, header]) => {
                    const colIndex = headers.get(header);
                    if (colIndex !== undefined) {
                        let value = item[field] || '';
                        if (field === 'episode') value = episodeId;
                        if (field === 'series') value = seriesId;
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

        // --- 3. Ensure Episode Exists in EPISODES ---
        try {
            // Fetch all episodes to check existence
            const epHeaders = await getHeaders('EPISODES');
            const epResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'EPISODES!A:D', // Assuming Series, Episode, Title are in first few cols
            });

            const rows = epResponse.data.values || [];
            const serIdx = epHeaders.get('Series');
            const epIdx = epHeaders.get('Episode');

            if (serIdx !== undefined && epIdx !== undefined) {
                const exists = rows.some(row =>
                    row[serIdx]?.toString().trim() === seriesId.toString() &&
                    row[epIdx]?.toString().trim() === episodeId.toString()
                );

                if (!exists) {
                    console.log(`Episode ${episodeId} for Series ${seriesId} missing. Creating...`);

                    const maxColIndex = Math.max(...Array.from(epHeaders.values()));
                    const newRow = new Array(maxColIndex + 1).fill('');

                    const setVal = (header: string, val: string) => {
                        const idx = epHeaders.get(header);
                        if (idx !== undefined) newRow[idx] = val;
                    };

                    setVal('Series', seriesId);
                    setVal('Episode', episodeId);
                    setVal('Title', `Episode ${episodeId}`); // Default title
                    if (defaultModel) setVal('Model', defaultModel);

                    await sheets.spreadsheets.values.append({
                        spreadsheetId: SPREADSHEET_ID,
                        range: 'EPISODES!A:ZZ',
                        valueInputOption: 'USER_ENTERED',
                        requestBody: { values: [newRow] },
                    });
                    console.log('Episode created.');
                } else {
                    console.log('Episode already exists.');
                }
            }
        } catch (epError) {
            console.error('Error ensuring episode exists:', epError);
            // Don't fail the whole request, just log
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
