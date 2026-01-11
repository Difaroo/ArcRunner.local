/* eslint-disable no-console */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkKieTaskStatus } from '@/lib/kie';
import { generateThumbnail } from '@/lib/thumbnail-generator';
import { persistLibraryImage, persistClipMedia } from '@/lib/media-persistence';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const targets = body.targets || [];

        // DEBUG LOG
        try {
            const logPath = '/Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/debug_poll.log';
            const logEntry = `[${new Date().toISOString()}] Poll Request: ${targets.length} targets. IDs: ${targets.map((t: any) => t.taskId).join(', ')}\n`;
            fs.appendFileSync(logPath, logEntry);
        } catch (e) { }

        console.log(`Poll started (DB Mode). Received ${targets.length} targets.`);

        if (!targets || targets.length === 0) {
            return NextResponse.json({ success: true, checked: 0, updated: 0 });
        }

        let updateCount = 0;

        // Sequential Processing to avoid Rate Limits (Batch Size 1 essentially)
        // We iterate through all targets sequentially.
        for (const item of targets) {
            const taskId = item.taskId;
            if (!taskId) continue;

            const idInt = parseInt(item.id);
            if (isNaN(idInt)) continue;

            const isLibrary = item.type === 'LIBRARY';

            try {

                // Strategy: Check specific model if provided, otherwise try likely ones
                // Library = Flux (Images). Clips = Veo (Video), Nano (Video), or Flux (Images).
                let strategies: ('flux' | 'veo' | 'nano' | 'kling')[];

                if (item.model) {
                    const m = item.model.toLowerCase();
                    if (m.includes('nano')) strategies = ['nano'];
                    else if (m.includes('veo')) strategies = ['veo'];
                    else if (m.includes('kling')) strategies = ['kling'];
                    else if (m.includes('flux')) strategies = ['flux'];
                    else strategies = ['veo', 'nano', 'flux', 'kling']; // Fallback
                } else if (isLibrary) {
                    strategies = ['flux'];
                } else {
                    strategies = ['veo', 'nano', 'flux', 'kling'];
                }
                let status = 'Generating';
                let resultUrl = '';
                let errorMsg = '';

                let bestResult = { status: 'Generating', resultUrl: '', errorMsg: '' };
                let foundAny = false;
                let currentPriority = 0; // 0=None, 1=Error, 2=Generating, 3=Done

                try {
                    // Iterate ALL strategies to find the best match (Done > Generating > Error)
                    for (const apiType of strategies) {
                        try {
                            const check = await checkKieTaskStatus(taskId, apiType);

                            // DEBUG LOG
                            try {
                                const logPath = '/Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/debug_poll.log';
                                fs.appendFileSync(logPath, `  -> ${apiType}: Status=${check.status} | Err=${check.errorMsg}\n`);
                            } catch (e) { }

                            const isNotFound = check.status === 'Error' && check.errorMsg && (check.errorMsg.includes('not found') || check.errorMsg.includes('404'));

                            if (!isNotFound) {
                                foundAny = true;

                                let priority = 0;
                                if (check.status === 'Done') priority = 3;
                                else if (check.status === 'Generating') priority = 2;
                                else if (check.status === 'Error') priority = 1;

                                // Update if higher priority
                                if (priority > currentPriority) {
                                    currentPriority = priority;
                                    bestResult = {
                                        status: check.status,
                                        resultUrl: check.resultUrl || '',
                                        errorMsg: check.errorMsg || ''
                                    };
                                }

                                // If Done, we can stop optimizing (Highest Priority)
                                if (priority === 3) break;
                            }
                        } catch (e: any) {
                            // LOG STRATEGY FAILURES
                            try {
                                const logPath = '/Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/debug_poll.log';
                                fs.appendFileSync(logPath, `  -> ${apiType}: EXCEPTION detected: ${e.message}\n`);
                            } catch (logErr) { }
                        }
                    }

                    if (foundAny) {
                        status = bestResult.status;
                        resultUrl = bestResult.resultUrl;
                        errorMsg = bestResult.errorMsg;
                    } else {
                        // No strategy found the task (all 404/Error)
                        try {
                            const logPath = '/Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/debug_poll.log';
                            fs.appendFileSync(logPath, `  -> WARN: No strategy found task ${taskId}. Keeping as Generating.\n`);
                        } catch (e) { }
                    }
                } catch (e: any) {
                    console.error(`[Poll] Critical Strategy Loop Error for ${taskId}:`, e);
                }

                console.log(`[Poll] Item ${idInt} [${taskId}] -> ${status}`);

                if (status === 'Error') {
                    resultUrl = errorMsg || 'Processing Error';
                }

                // Prepare Updates
                // FIX: Respect Generating status!
                let finalStatus = 'Error';
                if (status === 'Done') finalStatus = 'Done';
                else if (status === 'Generating') finalStatus = 'Generating';

                const finalResult = status === 'Done' ? (resultUrl || '') : (status === 'Generating' ? (bestResult.resultUrl || '') : (resultUrl || 'Error'));

                if (isLibrary) {
                    // --- LIBRARY UPDATE ---

                    // Fetch Metadata for naming
                    const currentItem = await db.studioItem.findUnique({
                        where: { id: idInt },
                        include: { series: true }
                    });

                    let newRefUrl = finalResult;

                    // Persistence Logic
                    if (status === 'Done' && finalResult && finalResult.startsWith('http')) {
                        try {
                            const seriesName = currentItem?.series?.name || 'UnknownSeries';
                            const epNum = currentItem?.episode || '0';
                            const assetName = currentItem?.name || 'Asset';
                            const existingRefs = currentItem?.refImageUrl ? currentItem.refImageUrl.split(',').length : 0;
                            const version = existingRefs + 1;
                            const customName = `${seriesName}.${epNum} ${assetName} ${version}`;

                            const { localPath } = await persistLibraryImage(finalResult, idInt.toString(), customName);
                            newRefUrl = localPath;
                        } catch (e) {
                            console.error(`Persistence failed for Item ${idInt}:`, e);
                        }
                    }

                    const existingUrl = currentItem?.refImageUrl || '';
                    const cleanExisting = existingUrl.replace(/^,|,$/g, '').trim();
                    const updatedUrlCsv = cleanExisting ? `${newRefUrl},${cleanExisting}` : newRefUrl;

                    console.log(`[PollLibrary] Updating Item ${idInt}: Status=${finalStatus}`, { newRefUrl });

                    await db.studioItem.update({
                        where: { id: idInt },
                        data: {
                            status: finalStatus,
                            refImageUrl: finalStatus === 'Done' ? updatedUrlCsv : existingUrl,
                            taskId: finalStatus === 'Done' ? '' : undefined
                        }
                    });
                    updateCount++;

                } else {
                    // --- CLIP UPDATE ---
                    let thumbnailPath = undefined;
                    let finalUrl = finalResult;

                    // Fetch existing clip to preserve history (Prepend new URL)
                    const existingClip = await db.clip.findUnique({
                        where: { id: idInt },
                        select: { resultUrl: true }
                    });
                    const existingResultUrl = existingClip?.resultUrl || '';

                    if (status === 'Done' && finalResult) {
                        try {
                            const { localPath, thumbnailPath: thumb } = await persistClipMedia(finalResult, idInt.toString());

                            finalUrl = localPath;
                            thumbnailPath = thumb;

                        } catch (e) {
                            console.error(`Persistence failed for Clip ${taskId}:`, e);
                            try {
                                const path = await generateThumbnail(finalResult, idInt.toString());
                                if (path) thumbnailPath = path;
                            } catch (thErr) { console.error('Thumbnail fallback failed', thErr); }
                        }
                    }

                    // Logic:
                    // If Done: Prepend new URL to history: "new, old1, old2"
                    // If Generating/Error: Overwrite/Set status (Likely usually just status update, but for Error we might want to keep history? User didn't specify, but Error usually replaces)
                    // ACTUALLY: If Error, we usually want to see the error.
                    // But if Generating, we might just be updating status.
                    // For now, let's strictly prepend ONLY if status is DONE.

                    let urlToSave = finalUrl;
                    if (status === 'Done') {
                        // ROBUST PREPEND Logic (Array-based)
                        const rawExisting = existingResultUrl || '';
                        const urls = rawExisting.split(',').map(u => u.trim()).filter(Boolean);

                        // If the newest result is NOT at the top, prepend it.
                        // (We allow duplicates in history if they are not immediate neighbors, assuming re-roll of same seed?)
                        // Actually, let's just ensure the First item matches new URL.
                        if (urls.length === 0 || urls[0] !== finalUrl) {
                            urls.unshift(finalUrl);
                        }
                        urlToSave = urls.join(',');
                    }

                    await db.clip.update({
                        where: { id: idInt },
                        data: {
                            status: finalStatus,
                            resultUrl: urlToSave,
                            ...(thumbnailPath ? { thumbnailPath } : {})
                        }
                    });
                    updateCount++;
                }

            } catch (err: any) {
                console.error(`[Poll] Error checking ${taskId}:`, err);

                // --- ROBUST ERROR HANDLING ---
                // Do NOT fail the task in DB if the error is transient (Network, Timeout, 5xx)
                // This allows the next poll cycle to retry.

                let isTransient = false;
                const msg = (err.message || "").toLowerCase();

                // 1. Timeout / Network
                if (msg.includes('timed out') || msg.includes('fetch failed') || msg.includes('network') || err.name === 'AbortError') {
                    isTransient = true;
                }

                // 2. Server Errors (5xx)
                // If Kie is overloaded (502/503/504), wait it out.
                if (err.status && err.status >= 500) {
                    isTransient = true;
                }

                if (isTransient) {
                    console.warn(`[Poll] Transient Error for ${taskId}. Skipping status update to allow retry. Reason: ${msg}`);
                    // Continue to next item without modifying DB
                    continue;
                }

                // If error is Terminal (4xx, or explicit API failure), fail the task.
                const failureMsg = err.message || "Polling Failed";

                try {
                    if (isLibrary) {
                        await db.studioItem.update({
                            where: { id: idInt },
                            data: {
                                status: 'Error',
                                refImageUrl: failureMsg,
                                taskId: undefined
                            }
                        });
                    } else {
                        await db.clip.update({
                            where: { id: idInt },
                            data: {
                                status: 'Error',
                                resultUrl: failureMsg
                            }
                        });
                    }
                    updateCount++; // Trigger frontend refresh
                } catch (dbErr) {
                    console.error(`[Poll] Failed to persist error state for ${idInt}:`, dbErr);
                }
            }

            // Artificial Delay to prevent API Rate Limits (5 requests per second?)
            await new Promise(r => setTimeout(r, 200));
        }

        return NextResponse.json({
            success: true,
            checked: targets.length,
            updated: updateCount
        });

    } catch (error: any) {
        console.error('Poll error (DB):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
