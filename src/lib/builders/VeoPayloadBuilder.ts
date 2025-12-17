import { PayloadBuilder, GenerationContext } from './PayloadBuilder';
import { VeoPayload } from '@/lib/kie-types';

export class VeoPayloadBuilder implements PayloadBuilder {

    supports(modelId: string): boolean {
        // Legacy: 'veo', 'veo-2', 'veo-fast' all map to this builder
        return modelId.startsWith('veo');
    }

    build(context: GenerationContext): VeoPayload {
        const { input, publicImageUrls } = context;

        // --- COPIED LOGIC FROM GenerateManager (Lines 100-143) ---
        // Preservation of "Golden Master Working State"

        const imageUrls = publicImageUrls;

        // Note: prompt building was outside the block, assuming it's passed or built before
        // Duplicating the prompt build helper logic or assuming it's in input.
        // In original code: const finalPrompt = input.clip.prompt || this.buildPrompt(input.clip, model);
        // We will assume input.prompt is populated by the Manager.

        const finalPrompt = input.prompt || `Cinematic shot. ${input.clip.action || ''} ${input.clip.dialog ? `Character says: "${input.clip.dialog}"` : ''}. ${input.clip.style || ''}. ${input.clip.camera || ''}. High quality.`;

        const payload: VeoPayload = {
            model: 'veo3_fast', // Strict match user requirement
            prompt: finalPrompt,
            aspectRatio: input.aspectRatio || '16:9',
            durationType: input.clip.duration || '5',
            enableTranslation: true,
            enableFallback: false
        };

        if (imageUrls.length > 0) {
            payload.imageUrls = imageUrls; // Array!
            payload.generationType = 'REFERENCE_2_VIDEO';
            // console.log([GenerateManager] Image-to-Video detected. Using veo3_fast.`); // Log removed for purity, handled by Manager?
        } else {
            payload.generationType = 'TEXT_2_VIDEO'; // Optional fallback
        }

        return payload;
    }
}
