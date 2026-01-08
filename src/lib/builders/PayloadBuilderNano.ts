import { PayloadBuilder, GenerationContext } from './PayloadBuilder';
import { PromptConstructor } from './PromptConstructor';
import { GenerateTaskInput } from '@/lib/generate-manager';

// Define Nano-specific payload types locally if not in kie-types
interface NanoPayload {
    model: string;
    callBackUrl?: string;
    input: {
        prompt: string;
        image_input?: string[];
        aspect_ratio?: string;
        resolution?: string;
        output_format?: string;
    };
}

export class PayloadBuilderNano implements PayloadBuilder {
    supports(modelId: string): boolean {
        return modelId.includes('nano') || modelId.includes('banana');
    }

    build(context: GenerationContext): NanoPayload {
        const { input } = context;

        // 1. Centralized Prompt & Image Selection
        const constructed = PromptConstructor.construct(context);
        const { prompt, imageUrls } = constructed;

        // 2. Nano Specifics
        const model = input.model && input.model.includes('nano') ? input.model : 'nano-banana-pro';

        return {
            model: model,
            input: {
                prompt: prompt,
                image_input: imageUrls.length > 0 ? imageUrls : undefined,
                aspect_ratio: input.aspectRatio || "16:9",
                resolution: "2K",
                output_format: "png"
            }
        };
    }
}
