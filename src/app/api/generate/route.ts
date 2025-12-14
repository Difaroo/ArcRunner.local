import { NextResponse } from 'next/server';
import { buildPrompt } from '@/lib/promptBuilder';
import { getLibraryItems } from '@/lib/library';
import { createVeoTask, VeoPayload } from '@/lib/kie';
import { AppService } from '@/lib/app-service';

export async function POST(req: Request) {
    let rowIndex = 0;
    try {
        const { clip, rowIndex: rIdx, model: requestedModel, aspectRatio: requestedRatio } = await req.json();

        if (!clip || typeof rIdx !== 'number') {
            return NextResponse.json({ error: 'Missing clip or rowIndex' }, { status: 400 });
        }
        rowIndex = rIdx;

        // 1. Initial Status (Fast Feedback)
        await AppService.setGeneratingStatus(rowIndex);

        // 2. Fetch Library & Build Prompt
        // Note: We fetch library items here for prompt building. 
        // AppService.resolveReferenceImages also fetches them, but caching/optimization is a future concern.
        const libraryItems = await getLibraryItems(clip.series);
        const prompt = buildPrompt(clip, libraryItems);
        console.log('Generated Prompt:', prompt);

        // 3. Resolve Images (Ref2Vid)
        // Uses the centralized AppService logic (Char -> Lib -> Drive -> Kie)
        const finalImageUrls = await AppService.resolveReferenceImages(clip, 3);

        // 4. Configure Model
        let model = 'veo3_fast';
        let aspectRatio = requestedRatio || '16:9';

        if (requestedModel === 'veo-quality') {
            model = 'veo3';
        }

        // Force Ref2Vid Settings
        if (finalImageUrls.length > 0) {
            console.log(`Ref2Vid Active (${finalImageUrls.length} images): Forcing veo3_fast / 16:9`);
            model = 'veo3_fast';
            aspectRatio = '16:9';
        }

        // 5. Construct Payload
        const payload: VeoPayload = {
            prompt,
            model,
            aspectRatio,
            enableFallback: true,
            enableTranslation: true,
        };

        if (finalImageUrls.length > 0) {
            payload.imageUrls = finalImageUrls;
            payload.generationType = 'REFERENCE_2_VIDEO';
        }

        console.log('Final Payload:', JSON.stringify(payload, null, 2));

        // 6. Call API
        // createVeoTask now uses the VeoStrategy via Facade
        const kieResponse = await createVeoTask(payload);
        const taskId = kieResponse.taskId;

        console.log('Kie Task Created:', taskId);

        // 7. Update Sheet Result
        await AppService.updateClipRow(rowIndex, {
            resultUrl: `TASK:${taskId}`,
            model: requestedModel || 'veo-fast'
        });

        return NextResponse.json({ success: true, taskId });

    } catch (error: any) {
        console.error('Generate error:', error);
        if (typeof rowIndex === 'number') {
            await AppService.setErrorStatus(rowIndex, error.message);
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
