export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, indexToColumnLetter, getHeaders } from '@/lib/sheets';
import { checkKieTaskStatus } from '@/lib/kie';


export async function POST(req: Request) {
    try {
        const body = await req.json();
        const targets = body.targets || [];

        console.log(`Poll started (Target Mode). Received ${targets.length} targets.`);

        if (!targets || targets.length === 0) {
            return NextResponse.json({ success: true, checked: 0, updated: 0 });
        }

        // 1. Fetch Headers ONLY (Optimized)
        // We need headers to know column indices (Status, Result URL, Ref Image URLs)
        // We assume headers don't change often, but we must fetch them to be safe.
        // Parallel fetch for Clips and Library headers if needed.
        const [clipsHeaders, libHeaders] = await Promise.all([
            getHeaders('CLIPS'),
            getHeaders('LIBRARY')
        ]);

        const sheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID;
        const updates: any[] = [];

        // 2. Poll Kie.ai for each target
        for (const item of targets) {
            const taskId = item.taskId;
            if (!taskId) continue;

            const idInt = parseInt(item.id);
            if (isNaN(idInt)) continue;

            // Compute Sheet Row: 
            // ID is 0-based index of DATA rows.
            // Sheet has 1 Header Row.
            // So Row 1 (Header), Row 2 (Data 0), Row 3 (Data 1)...
            const sheetRow = idInt + 2;

            // Determine API Type
            // Library items are generally Flux images
            // Clips can be mixed, but we don't have the 'Model' from the sheet anymore since we didn't fetch it.
            // However, we can infer from the Task ID sometimes, or just try both?
            // Actually, for Robustness, we should probably store 'type' in resultUrl or pass it from frontend?
            // The frontend has 'model' in the Clip object! Ideally frontend passes it.
            // For now, let's keep the heuristic: Library = flux, Clips = try infer or default veo?
            // Wait, the previous logic scanned the sheet for 'Model'.
            // Let's rely on a safe heuristic or ask frontend to pass 'model' in target.
            // If we fail, we might get a 404 from Kie, which is fine (handled).

            // Heuristic:
            const isLibrary = item.type === 'LIBRARY';
            let apiType: 'flux' | 'veo' = isLibrary ? 'flux' : 'veo';

            // If frontend passes model, better. For now default VEO for clips unless we know it's Flux.
            // Refinement: Try Veo first for clips.

            let status = '';
            let resultUrl = '';
            let errorMsg = '';

            try {
                // We'll trust the default strategy. If we really need model, we should update usePolling to pass it.
                // Assuming most Clips are Veo, Library is Flux.
                const check = await checkKieTaskStatus(taskId, apiType);
                status = check.status; // 'Generating', 'Done', 'Error'
                resultUrl = check.resultUrl;
                errorMsg = check.errorMsg;

                // Mixed Model Fallback (Hack for robustness if type mismatch):
                if (status === 'Error' && errorMsg && (errorMsg.includes('not found') || errorMsg.includes('404'))) {
                    const altType = apiType === 'flux' ? 'veo' : 'flux';
                    // console.log(`Task not found as ${apiType}, trying ${altType}...`);
                    const checkAlt = await checkKieTaskStatus(taskId, altType);
                    if (checkAlt.status !== 'Error' || !checkAlt.errorMsg.includes('not found')) {
                        status = checkAlt.status;
                        resultUrl = checkAlt.resultUrl;
                        errorMsg = checkAlt.errorMsg;
                    }
                }

                if (status === 'Generating') {
                    continue; // No update
                }

                if (status === 'Error') {
                    resultUrl = errorMsg || 'Processing Error';
                }

            } catch (err: any) {
                console.warn(`Poll loop error for ${taskId}:`, err);
                status = 'Error';
                resultUrl = `POLL_ERR: ${err.message}`;
            }

            // 3. Prepare Updates
            if (status === 'Done' || status === 'Error') {

                const finalResult = status === 'Done' ? (resultUrl || '') : (resultUrl || 'Error'); // resultUrl holds error msg on Error status

                if (item.type === 'LIBRARY') {
                    const colIndex = libHeaders.get('Ref Image URLs');
                    if (colIndex !== undefined) {
                        const colLetter = indexToColumnLetter(colIndex);
                        const range = `LIBRARY!${colLetter}${sheetRow}`;
                        updates.push(sheets.spreadsheets.values.update({
                            spreadsheetId,
                            range,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: { values: [[finalResult]] }
                        }));
                    }

                } else {
                    // Update CLIPS
                    const statusCol = clipsHeaders.get('Status');
                    const urlCol = clipsHeaders.get('Result URL');

                    // Update Status
                    if (statusCol !== undefined) {
                        const cellStatus = status === 'Done' ? 'Done' : 'Error';
                        updates.push(sheets.spreadsheets.values.update({
                            spreadsheetId,
                            range: `CLIPS!${indexToColumnLetter(statusCol)}${sheetRow}`,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: { values: [[cellStatus]] }
                        }));
                    }

                    // Update URL
                    if (urlCol !== undefined) {
                        updates.push(sheets.spreadsheets.values.update({
                            spreadsheetId,
                            range: `CLIPS!${indexToColumnLetter(urlCol)}${sheetRow}`,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: { values: [[finalResult]] }
                        }));
                    }
                }
            }
        }

        if (updates.length > 0) {
            await Promise.all(updates);
            console.log(`Updated ${updates.length} sheets cells.`);
        }

        return NextResponse.json({
            success: true,
            checked: targets.length,
            updated: updates.length
        });

    } catch (error: any) {
        console.error('Poll error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

