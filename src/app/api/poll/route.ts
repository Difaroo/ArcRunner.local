import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, getHeaders, indexToColumnLetter, getSheetData, parseHeaders } from '@/lib/sheets';
import { getFluxTask, getVeoTask } from '@/lib/kie';
import { saveFile, downloadAndSave } from '@/lib/storage';
import mime from 'mime';

export async function POST(req: Request) {
    try {
        console.log('Poll started (Server Scan Mode)...');

        // 1. Fetch ALL Data from Sheets (Source of Truth)
        // We need headers and data to identify which rows to poll
        const [clipsData, libraryData] = await Promise.all([
            getSheetData('CLIPS!A1:ZZ'),
            getSheetData('LIBRARY!A1:ZZ')
        ]);

        const parseSheet = (data: any[][] | null | undefined) => {
            if (!data || data.length === 0) return { headers: new Map<string, number>(), rows: [] };
            const headers = parseHeaders(data);
            const rows = data.slice(1);
            return { headers, rows };
        };

        const clipsSheet = parseSheet(clipsData);
        const librarySheet = parseSheet(libraryData);

        const targets: any[] = [];

        // 2. Scan CLIPS Sheet
        const clipsStatusIdx = clipsSheet.headers.get('Status');
        const clipsUrlIdx = clipsSheet.headers.get('Result URL');
        const clipsModelIdx = clipsSheet.headers.get('Model');

        if (clipsStatusIdx !== undefined && clipsUrlIdx !== undefined) {
            clipsSheet.rows.forEach((row, index) => {
                const status = row[clipsStatusIdx];
                const url = row[clipsUrlIdx];

                // Identify candidates: Status is Generating OR URL has TASK: prefix (and not done/http)
                if (status === 'Generating' || (url && String(url).startsWith('TASK:'))) {
                    // Double check it's not already a URL
                    if (url && String(url).startsWith('http')) return;

                    targets.push({
                        type: 'CLIP',
                        id: index.toString(), // 0-based index relative to data rows
                        sheetRow: index + 2, // 1-based index including header
                        taskId: url, // expecting TASK: ID here
                        model: clipsModelIdx !== undefined ? row[clipsModelIdx] : ''
                    });
                }
            });
        }

        // 3. Scan LIBRARY Sheet
        const libUrlIdx = librarySheet.headers.get('Ref Image URLs');
        const libTypeIdx = librarySheet.headers.get('Type');

        if (libUrlIdx !== undefined) {
            librarySheet.rows.forEach((row, index) => {
                const url = row[libUrlIdx];

                // Identify candidates: URL starts with TASK:
                if (url && String(url).startsWith('TASK:')) {
                    targets.push({
                        type: 'LIBRARY',
                        id: index.toString(),
                        sheetRow: index + 2,
                        taskId: url,
                        model: 'flux' // Library items are generally Flux images
                    });
                }
            });
        }

        console.log(`Found ${targets.length} items to poll.`);

        if (targets.length === 0) {
            return NextResponse.json({ success: true, checked: 0 });
        }

        // 4. Poll Kie.ai
        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;
        const updates: any[] = [];

        for (const item of targets) {
            let taskId = item.taskId;
            if (taskId && taskId.startsWith('TASK:')) {
                taskId = taskId.replace('TASK:', '');
            } else if (taskId && taskId.startsWith('task_')) {
                // Clean mapping
            }

            if (!taskId) continue;

            // Determine API Type
            const isLibrary = item.type === 'LIBRARY';
            const model = (item.model || '').toLowerCase();
            const isFlux = isLibrary || model.includes('flux') || model.includes('journey');

            let status = '';
            let resultUrl = '';

            try {
                if (isFlux) {
                    const kieRes = await getFluxTask(taskId);
                    const state = kieRes.data?.state;

                    status = state === 'success' ? 'Done' :
                        state === 'fail' ? 'Error' : 'Generating';

                    if (status === 'Done' && kieRes.data?.resultJson) {
                        try {
                            const results = JSON.parse(kieRes.data.resultJson);
                            if (results.images?.length > 0) {
                                resultUrl = results.images[0].url;
                            } else if (results.resultUrls?.length > 0) {
                                resultUrl = results.resultUrls[0];
                            }
                        } catch (e) {
                            console.error(`Error parsing resultJson for task ${taskId}:`, e);
                            status = 'Error';
                        }
                    }
                } else {
                    const kieRes = await getVeoTask(taskId);
                    const s = kieRes.data?.status;

                    status = (s === 'COMPLETED' || s === 'SUCCEEDED') ? 'Done' :
                        (s === 'FAILED' || s === 'ERROR') ? 'Error' : 'Generating';

                    if (status === 'Done') {
                        resultUrl = kieRes.data?.videoUrl || kieRes.data?.url || kieRes.data?.images?.[0]?.url || '';
                    }
                }
            } catch (err) {
                console.warn(`Polling failed for ${taskId}:`, err);
                continue;
            }

            // 5. Prepare Updates
            if ((status === 'Done' && resultUrl) || status === 'Error') {

                /* 
                 * OPT-IN ARCHIVAL STRATEGY:
                 * We do NOT download automatically here.
                 * We simply update the sheet with the remote resultUrl.
                 * The user will click "Save Reference Image" in the UI to archive it.
                 */

                if (item.type === 'LIBRARY') {
                    // Update Library Ref Image URL matches Result URL
                    const colIndex = librarySheet.headers.get('Ref Image URLs')!; // We know it exists
                    const range = `LIBRARY!${indexToColumnLetter(colIndex)}${item.sheetRow}`;

                    // If Error, maybe just leave as TASK:? Or clear? 
                    // Let's clear or mark ERROR:
                    const val = status === 'Error' ? 'ERROR_GENERATING' : resultUrl;

                    updates.push(sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range,
                        valueInputOption: 'USER_ENTERED',
                        requestBody: { values: [[val]] }
                    }));

                } else {
                    // Update CLIPS
                    const statusCol = clipsSheet.headers.get('Status')!;
                    const urlCol = clipsSheet.headers.get('Result URL')!;

                    // Update Status
                    const cellStatus = status === 'Done' ? 'Done' : 'Error';
                    updates.push(sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range: `CLIPS!${indexToColumnLetter(statusCol)}${item.sheetRow}`,
                        valueInputOption: 'USER_ENTERED',
                        requestBody: { values: [[cellStatus]] }
                    }));

                    // Update URL (Only if Done)
                    if (status === 'Done' && resultUrl) {
                        updates.push(sheets.spreadsheets.values.update({
                            spreadsheetId,
                            range: `CLIPS!${indexToColumnLetter(urlCol)}${item.sheetRow}`,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: { values: [[resultUrl]] }
                        }));
                    }
                }
            }
        }

        if (updates.length > 0) {
            await Promise.all(updates);
            console.log(`Updated ${updates.length} sheets cells.`);
        }

        return NextResponse.json({ success: true, checked: targets.length, updated: updates.length });

    } catch (error: any) {
        console.error('Poll error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
