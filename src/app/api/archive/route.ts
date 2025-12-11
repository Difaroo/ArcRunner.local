import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, getSheetData, parseHeaders, indexToColumnLetter } from '@/lib/sheets';
import { downloadAndSave } from '@/lib/storage';

export async function POST(req: Request) {
    try {
        const { url, id, type } = await req.json();

        if (!url || !id) {
            return NextResponse.json({ error: 'Missing url or id' }, { status: 400 });
        }

        console.log(`[Archive] Request to archive ${url} for ID ${id} (${type})`);



        // 2. Update Google Sheet
        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;

        // Fetch sheet data to find row
        const sheetName = type === 'library' ? 'LIBRARY' : 'CLIPS';
        const data = await getSheetData(`${sheetName}!A1:ZZ`);

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'Failed to read sheet data' }, { status: 500 });
        }

        const headers = parseHeaders(data);
        const rows = data.slice(1);

        // Find row index (0-based relative to data)
        // If type is Clip, id is likely the Row Index or ID. 
        // For Clips, 'id' passed from frontend is usually the 'id' field in JSON which maps to row index.
        const rowIndex = parseInt(id);

        if (isNaN(rowIndex)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }

        const sheetRow = rowIndex + 2; // +1 for header, +1 for 1-based index

        // Determine Column to Update and Get Metadata for Filename
        let targetColIndex = -1;
        let filename = id; // Default to ID if metadata fetch fails

        const getValue = (header: string) => {
            const idx = headers.get(header);
            return idx !== undefined ? rows[rowIndex][idx] : '';
        };

        if (type === 'library') {
            targetColIndex = ['Ref Image URLs', 'Ref Image URL', 'Ref Images', 'Ref Image']
                .map(h => headers.get(h))
                .find(idx => idx !== undefined) ?? -1;

            // Name (Type)
            const name = getValue('Name');
            const itemType = getValue('Type');
            filename = name ? `${name} (${itemType})` : `Library_${id}`;

        } else {
            targetColIndex = headers.get('Result URL') ?? -1;

            // Construct: Scene Title [ver]
            const scene = getValue('Scene #') || '0';
            const title = getValue('Title') || 'Untitled';
            const status = getValue('Status') || '';

            // Calculate Version
            let ver = 1;
            if (status.startsWith('Saved')) {
                const match = status.match(/Saved \[(\d+)\]/);
                if (match) {
                    ver = parseInt(match[1]); // Use current version, or +1? Archive preserves current state.
                } else if (status === 'Saved') {
                    ver = 1;
                }
            }

            // Clean Title
            const safeTitle = title.replace(/[^a-zA-Z0-9 ]/gi, '');
            const safeScene = scene.replace(/[^0-9.]/g, '');

            filename = `${safeScene} ${safeTitle}`;
            if (ver > 1) {
                filename += ` ${ver.toString().padStart(2, '0')}`;
            }
        }

        if (targetColIndex === -1) {
            return NextResponse.json({ error: 'Could not find target column in sheet' }, { status: 500 });
        }

        console.log(`[Archive] Saving as: ${filename}`);

        // 1. Download & Save Locally
        const localUrl = await downloadAndSave(url, filename, 'generated');

        if (!localUrl) {
            return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
        }

        const range = `${sheetName}!${indexToColumnLetter(targetColIndex)}${sheetRow}`;

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[localUrl]] }
        });

        return NextResponse.json({ success: true, url: localUrl });

    } catch (error: any) {
        console.error('Archive error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
