export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkKieTaskStatus } from '@/lib/kie';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const targets = body.targets || [];

        console.log(`Poll started (DB Mode). Received ${targets.length} targets.`);

        if (!targets || targets.length === 0) {
            return NextResponse.json({ success: true, checked: 0, updated: 0 });
        }

        let updateCount = 0;

        for (const item of targets) {
            const taskId = item.taskId;
            if (!taskId) continue;

            const idInt = parseInt(item.id);
            if (isNaN(idInt)) continue;

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

                if (status === 'Generating') {
                    continue;
                }

                if (status === 'Error') {
                    resultUrl = errorMsg || 'Processing Error';
                }

                // Prepare Updates
                if (status === 'Done' || status === 'Error') {

                    const finalResult = status === 'Done' ? (resultUrl || '') : (resultUrl || 'Error');
                    const finalStatus = status === 'Done' ? 'Saved' : 'Error'; // Use 'Saved' for consistency with Sheets history

                    if (isLibrary) {
                        await db.studioItem.update({
                            where: { id: idInt },
                            data: {
                                refImageUrl: finalResult
                            }
                        });
                        updateCount++;
                    } else {
                        await db.clip.update({
                            where: { id: idInt },
                            data: {
                                status: finalStatus,
                                resultUrl: finalResult
                            }
                        });
                        updateCount++;
                    }
                }

            } catch (err: any) {
                console.warn(`Poll loop error for ${taskId}:`, err);
            }
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
