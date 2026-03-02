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
        const { prompt, negativePrompt, imageUrls, warnings } = constructed;

        // If Veo was run through GenerateManager (which resolves to base64 for 'veo'), 
        // those are stored in context.base64Images. Otherwise fallback to constructed imageUrls
        const finalImages = context.base64Images && context.base64Images.length > 0
            ? context.base64Images
            : imageUrls;

        // Re-inject Negatives inline for Veo (not supported in payload)
        let finalPrompt = prompt;
        if (negativePrompt) {
            finalPrompt += `\n\nNO: [${negativePrompt}].`;
        }

        if (warnings.length > 0) {
            console.warn('[PayloadBuilderVeo] Warnings:', warnings);
        }

        // 2. Veo Specifics - Determine Generation Type
        const requestedModel = input.model || 'veo3_fast';
        let generationType = 'TEXT_TO_VIDEO';

        if (input.model === 'veo-s2e') {
            // S2E Requested
            if (finalImages.length >= 2) {
                generationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO'; // Strict S2E (image-to-video mode)
            } else if (finalImages.length === 1) {
                generationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO'; // 1 image is supported by this mode
                console.warn('[PayloadBuilderVeo] S2E requested but <2 images. Using First and Last mode for 1 image.');
            } else {
                generationType = 'TEXT_2_VIDEO';
                console.warn('[PayloadBuilderVeo] S2E requested but 0 images. Fallback to T2V.');
            }
        } else {
            // Standard Veo logic
            if (finalImages.length > 0) {
                generationType = 'REFERENCE_2_VIDEO'; // Standard Reference to Video
            } else {
                generationType = 'TEXT_2_VIDEO';
            }
        }

        // Map UI model selection to API Model ID
        let apiModelId = 'veo3_fast';
        const isTextOnly = finalImages.length === 0;

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
        const payload: VeoPayload = {
            taskType: generationType,
            generationType: generationType, // Add matching interface key
            model: apiModelId,
            prompt: finalPrompt, // Use the constructed prompt with re-injected negatives
            aspectRatio: input.aspectRatio || "16:9",
            durationType: (input.clip.duration && input.clip.duration === '10s') ? '10' : '5',
            enableTranslation: true
        };

        // Veo 3.1 strictly expects HTTP URLs mapping to `imageUrls`. Base64s are completely unsupported.
        payload.imageUrls = finalImages;

        return payload;
    }
}
