import { PayloadBuilder, GenerationContext } from './PayloadBuilder';
import { PromptConstructor } from './PromptConstructor';
import { VeoPayload } from '@/lib/kie-types';

export class PayloadBuilderVeo implements PayloadBuilder {
    supports(modelId: string): boolean {
        // Legacy: 'veo', 'veo-2', 'veo-fast' all map to this builder
        return modelId.startsWith('veo');
    }

    validate(context: GenerationContext): void {
        if (!context.input) throw new Error('Input missing from GenerationContext');
    }

    build(context: GenerationContext): VeoPayload {
        const { input } = context;

        // 1. Centralized Prompt & Image Selection
        const constructed = PromptConstructor.construct(context);
        const { prompt, imageUrls, warnings } = constructed;

        if (warnings.length > 0) {
            console.warn('[PayloadBuilderVeo] Warnings:', warnings);
        }

        // 2. Veo Specifics - Determine Generation Type
        const requestedModel = input.model || 'veo3_fast';
        let generationType = 'TEXT_TO_VIDEO';

        if (input.model === 'veo-s2e') {
            // S2E Requested
            if (imageUrls.length >= 2) {
                generationType = 'IMAGE_TO_VIDEO'; // Strict S2E
            } else if (imageUrls.length === 1) {
                // Fallback handled by PromptConstructor selection (returns 1 image)
                generationType = 'REFERENCE_2_VIDEO';
                console.warn('[PayloadBuilderVeo] S2E requested but <2 images. Fallback to Ref-2-Video.');
            } else {
                generationType = 'TEXT_2_VIDEO';
                console.warn('[PayloadBuilderVeo] S2E requested but 0 images. Fallback to T2V.');
            }
        } else {
            // Standard Veo logic
            if (imageUrls.length > 0) {
                generationType = 'REFERENCE_2_VIDEO'; // Standard I2V
                // Note: Veo API might treat >1 image as "Start/End" if mode is I2V?
                // Verify API docs: usually I2V takes array. 
                // If standard Veo, we probably want I2V prompt logic which PromptConstructor provided.
            } else {
                generationType = 'TEXT_2_VIDEO';
            }
        }

        // Map UI model selection to API Model ID
        let apiModelId = 'veo3_fast';
        const isTextOnly = imageUrls.length === 0;

        if (input.model === 'veo-quality') {
            if (isTextOnly) {
                apiModelId = 'veo3'; // Quality allowed for Text-Only
            } else {
                // API CONSTRAINT: Reference-to-Video only supports Veo Fast.
                // We must downgrade to Fast if images are present.
                apiModelId = 'veo3_fast';
                console.warn('[PayloadBuilderVeo] Downgrading Veo Quality to Fast: Reference Images require Fast model.');
            }
        } else if (input.model === 'veo-s2e') {
            apiModelId = 'veo3_fast';
        }

        // 3. Payload Assembly
        return {
            taskType: generationType,
            generationType: generationType, // Add matching interface key
            model: apiModelId,
            prompt: prompt, // Use the constructed prompt
            imageUrls: imageUrls, // Use the selected images
            aspectRatio: input.aspectRatio || "16:9",
            durationType: (input.clip.duration && input.clip.duration === '10s') ? '10' : '5',
            enableTranslation: true,
            enableFallback: true
        };
    }
}
