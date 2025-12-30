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

        // Parallel Processing with Concurrency Limit (Batch Size 5)
        const BATCH_SIZE = 5;
        for (let i = 0; i < targets.length; i += BATCH_SIZE) {
            const chunk = targets.slice(i, i + BATCH_SIZE);

            await Promise.all(chunk.map(async (item: any) => {
                const taskId = item.taskId;
                if (!taskId) return;

                const idInt = parseInt(item.id);
                if (isNaN(idInt)) return;

                const isLibrary = item.type === 'LIBRARY';
                let apiType: 'flux' | 'veo' = isLibrary ? 'flux' : 'veo';

                let status = 'Generating';
                let resultUrl = '';
                let errorMsg = '';

                try {
                    const check = await checkKieTaskStatus(taskId, apiType);
                    status = check.status;
                    resultUrl = check.resultUrl;
                    errorMsg = check.errorMsg;

                    // Mixed Model Fallback
                    if (status === 'Error' && errorMsg && (errorMsg.includes('not found') || errorMsg.includes('404'))) {
                        const altType = apiType === 'flux' ? 'veo' : 'flux';
                        const checkAlt = await checkKieTaskStatus(taskId, altType);
                        if (checkAlt.status !== 'Error' || !checkAlt.errorMsg.includes('not found')) {
                            status = checkAlt.status;
                            resultUrl = checkAlt.resultUrl;
                            errorMsg = checkAlt.errorMsg;
                        }
                    }

                    if (status === 'Generating') return;

                    if (status === 'Error') {
                        resultUrl = errorMsg || 'Processing Error';
                    }

                    // Prepare Updates
                    if (status === 'Done' || status === 'Error') {

                        const finalResult = status === 'Done' ? (resultUrl || '') : (resultUrl || 'Error');
                        const finalStatus = status === 'Done' ? 'Done' : 'Error';

                        if (isLibrary) {
                            let thumbnailPath: string | undefined = undefined;
                            let finalStoredUrl = finalResult; // Default to remote

                            // Only persist if success and it's a valid remote URL
                            if (status === 'Done' && finalResult?.startsWith('http')) {
                                try {
                                    const saved = await persistLibraryImage(finalResult, idInt.toString());
                                    // Use the LOCAL path as the canonical URL
                                    finalStoredUrl = saved.localPath;
                                    thumbnailPath = saved.thumbnailPath || undefined;
                                } catch (e) {
                                    console.error(`Library persistence failed for ${taskId}, keeping remote URL:`, e);
                                    // Fallback: Try generic thumbnail gen
                                    try {
                                        const path = await generateThumbnail(finalResult, idInt.toString());
                                        if (path) thumbnailPath = path;
                                    } catch (e2) { }
                                }
                            }

                            // Fetch current state to prepend, not overwrite
                            const currentItem = await db.studioItem.findUnique({ where: { id: idInt } });
                            const existingUrl = currentItem?.refImageUrl || '';

                            // Prepend the new URL (Local or Remote)
                            const cleanExisting = existingUrl.replace(/^,|,$/g, '').trim();
                            const newRefUrl = cleanExisting ? `${finalStoredUrl},${cleanExisting}` : finalStoredUrl;

                            console.log(`[PollLibrary] Updating Item ${idInt}: Status=${finalStatus}`, {
                                finalStoredUrl,
                                newRefUrl,
                                thumbnailPath
                            });

                            await db.studioItem.update({
                                where: { id: idInt },
                                data: {
                                    status: finalStatus,
                                    refImageUrl: finalStatus === 'Done' ? newRefUrl : existingUrl,
                                    ...(thumbnailPath ? { thumbnailPath } : {})
                                }
                            });
                            updateCount++;
                        } else {
                            let thumbnailPath = undefined;
                            if (status === 'Done' && finalResult) {
                                try {
                                    // Generate thumbnail before update to keep it atomic if possible, 
                                    // or update separately. Here we do it sequentially to ensure db record is complete.
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
                    }

                } catch (err: any) {
                    console.warn(`Poll loop error for ${taskId}:`, err);
                }
            }));
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
