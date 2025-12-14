import { NextResponse } from 'next/server';
import { buildPrompt } from '@/lib/promptBuilder';
import { getLibraryItems } from '@/lib/library';
import { createFluxTask, FluxPayload } from '@/lib/kie';
import { AppService } from '@/lib/app-service';

export async function POST(req: Request) {
    let rowIndex = 0;
    try {
        const { clip, rowIndex: rIdx, model: requestedModel, aspectRatio: requestedRatio } = await req.json();

        if (!clip || typeof rIdx !== 'number') {
            return NextResponse.json({ error: 'Missing clip or rowIndex' }, { status: 400 });
        }
        rowIndex = rIdx;

        // 1. Initial Status
        await AppService.setGeneratingStatus(rowIndex);

        // 2. Fetch Library & Prompt
        const libraryItems = await getLibraryItems(clip.series);
        const prompt = buildPrompt(clip, libraryItems);
        console.log('Generated Flux Prompt:', prompt);

        // 3. Resolve Images (Ref Image for Image-to-Image)
        // Flux allows Image input (Pro mode)
        const imageUrls = await AppService.resolveReferenceImages(clip, 1);

        // 4. Configure Model
        let model = 'flux-2/flex-text-to-image'; // Default to Flex for cost/speed
        // Note: We can expand this logic if the UI sends specific model slugs

        const input: any = {
            prompt,
            aspect_ratio: requestedRatio || '16:9',
            resolution: '2K' // Required Uppercase
        };

        // 5. Switch to I2I if Images Present
        if (imageUrls.length > 0) {
            console.log('Flux Input Image Detected: Switching to pro-image-to-image');
            model = 'flux-2/pro-image-to-image';
            input.input_urls = imageUrls;
            input.strength = 0.75;
        }

        const payload: FluxPayload = {
            model,
            input
        };

        console.log('Flux Payload:', JSON.stringify(payload, null, 2));

        // 6. Call API
        const kieResponse = await createFluxTask(payload);
        const taskId = kieResponse.taskId;

        console.log('Flux Task Created:', taskId);

        // 7. Update Sheet Result
        await AppService.updateClipRow(rowIndex, {
            resultUrl: `TASK:${taskId}`,
            model: requestedModel || 'flux-pro' // Log what user clicked
        });

        return NextResponse.json({ success: true, taskId });

    } catch (error: any) {
        console.error('Flux Generate Error:', error);
        if (typeof rowIndex === 'number') {
            await AppService.setErrorStatus(rowIndex, error.message);
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
