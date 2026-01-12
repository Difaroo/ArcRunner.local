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
        const { prompt, negativePrompt, imageUrls } = constructed;

        // 2. Nano Specifics
        // Reverting to UI ID 'nano-banana-pro' as 'nano-banana' was rejected (422)
        const model = 'nano-banana-pro';

        // COMPLIANCE: API does not support negative_prompt field.
        // STRATEGY: Append negatives to the end of the prompt string context.
        let fullPrompt = prompt;
        if (negativePrompt) {
            fullPrompt += `\n\nNEGATIVE PROMPT: [${negativePrompt}]`;
        }

        return {
            model: model,
            input: {
                prompt: fullPrompt,
                image_input: imageUrls.length > 0 ? imageUrls : undefined,
                aspect_ratio: input.aspectRatio || "16:9",
                resolution: "2K",
                output_format: "png",
                seed: input.seed
            }
        };
    }
}
