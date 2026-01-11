import { PayloadBuilder, GenerationContext } from './PayloadBuilder';
import { PromptConstructor } from './PromptConstructor';
import { FluxPayload } from '@/lib/kie-types';

export class PayloadBuilderFlux implements PayloadBuilder {
    supports(modelId: string): boolean {
        return modelId.includes('flux');
    }

    validate(context: GenerationContext): void {
        if (!context.input) throw new Error('Input missing from GenerationContext');
        // Add more specific Flux checks here if needed
    }

    build(context: GenerationContext): FluxPayload {
        const { input } = context;

        // 1. Centralized Prompt & Image Selection
        const constructed = PromptConstructor.construct(context);
        const { prompt, imageUrls, warnings } = constructed;

        if (warnings.length > 0) console.warn('[PayloadBuilderFlux] Warnings:', warnings);

        // 2. Flux Specifics
        let model = input.model || 'flux-pro';
        if (model === 'flux' || model === 'flux-pro') model = 'flux-2/flex-image-to-image';

        // Calculate Guidance Scale (kept local as it's a numeric param)
        const styleStrength = input.styleStrength || 5;
        const guidanceScale = 1.5 + ((styleStrength - 1) * (8.5 / 9));

        return {

            model: model,
            input: {
                prompt: prompt,
                aspect_ratio: input.aspectRatio || "16:9",
                resolution: "1K",
                safety_tolerance: 5,
                guidance: Number(guidanceScale.toFixed(1)) || 2.5,
                num_inference_steps: 50,
                // Pass selected images if any
                ...(imageUrls.length > 0 ? { input_urls: imageUrls } : {}),
                // Only pass seed if provided
                ...(input.seed !== undefined && input.seed !== null ? { seed: Number(input.seed) } : {})
            }
        };
    }
}
