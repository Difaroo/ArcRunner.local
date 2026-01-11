import { PayloadBuilder, GenerationContext } from './PayloadBuilder';
import { PromptConstructor } from './PromptConstructor';
import { NanoPayload } from '@/lib/kie-types';

export class PayloadBuilderNano implements PayloadBuilder {
    supports(modelId: string): boolean {
        return modelId.includes('nano') || modelId.includes('banana');
    }

    validate(context: GenerationContext): void {
        if (!context.input) throw new Error('Input missing from GenerationContext');
    }

    build(context: GenerationContext): NanoPayload {
        const { input } = context;

        // 1. Centralized Prompt & Image Selection
        const constructed = PromptConstructor.construct(context);
        const { prompt, imageUrls } = constructed;

        // 2. Nano Specifics
        // Reverting to UI ID 'nano-banana-pro' as 'nano-banana' was rejected (422)
        const model = 'nano-banana-pro';

        return {
            model: model,
            input: {
                prompt: prompt,
                image_input: imageUrls.length > 0 ? imageUrls : undefined,
                aspect_ratio: input.aspectRatio || "16:9",
                resolution: "2K",
                output_format: "png",
                seed: input.seed
            }
        };
    }
}
