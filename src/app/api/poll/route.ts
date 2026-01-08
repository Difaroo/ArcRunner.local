export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkKieTaskStatus } from '@/lib/kie';
import { generateThumbnail } from '@/lib/thumbnail-generator';
import { persistLibraryImage } from '@/lib/media-persistence';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const targets = body.targets || [];

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

            // Strategy: Nano/Flux are image based. Veo is video.
            // Default clips to veo (legacy) but fallback to flux/nano if not found.
            let apiType: 'flux' | 'veo' | 'nano' = isLibrary ? 'flux' : 'veo';

            let status = 'Generating';
            let resultUrl = '';
            let errorMsg = '';

            try {
                // Primary Status Check
                const check = await checkKieTaskStatus(taskId, apiType);
                status = check.status;
                resultUrl = check.resultUrl;
                errorMsg = check.errorMsg;

                // Fallback Check (Cross-Type Resilience)
                // If we checked 'veo' but it was actually a 'nano' (image) task, it might error or return not found
                if (status === 'Error' && errorMsg && (errorMsg.includes('not found') || errorMsg.includes('404'))) {
                    console.log(`[Poll] ${taskId} not found via ${apiType}, trying alternate...`);
                    const altType = apiType === 'flux' ? 'veo' : 'flux';
                    const checkAlt = await checkKieTaskStatus(taskId, altType);
                    if (checkAlt.status !== 'Error' || !checkAlt.errorMsg.includes('not found')) {
                        status = checkAlt.status;
                        resultUrl = checkAlt.resultUrl;
                        errorMsg = checkAlt.errorMsg;
                    }
                }

                if (status === 'Generating') continue;

                console.log(`[Poll] Item ${idInt} [${taskId}] -> ${status}`);

                if (status === 'Error') {
                    resultUrl = errorMsg || 'Processing Error';
                }

                // Prepare Updates
                const finalStatus = status === 'Done' ? 'Done' : 'Error';
                const finalResult = status === 'Done' ? (resultUrl || '') : (resultUrl || 'Error');

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
                    if (status === 'Done' && finalResult) {
                        try {
                            const path = await generateThumbnail(finalResult, idInt.toString());
                            if (path) thumbnailPath = path;
                        } catch (e) {
                            console.error(`Thumbnail gen failed for ${taskId}:`, e);
                        }
                    }

                    await db.clip.update({
                        where: { id: idInt },
                        data: {
                            status: finalStatus,
                            resultUrl: finalResult,
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
