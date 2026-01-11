import { PayloadBuilder, GenerationContext } from './PayloadBuilder';
import { PromptConstructor } from './PromptConstructor';
import { KlingPayload } from '@/lib/kie-types';

export class PayloadBuilderKling implements PayloadBuilder {
    supports(modelId: string): boolean {
        return modelId.includes('kling');
    }

    validate(context: GenerationContext): void {
        if (!context.input) throw new Error('Input missing from GenerationContext');
        // Kling usually requires an image, but user said "Assume in absence of images, it works"
        // So we won't throw if 0 images, but we might warn.
    }

    build(context: GenerationContext): KlingPayload {
        const { input } = context;

        // 1. Centralized Prompt & Image Selection
        // Kling 2.6 accepts 1 image.
        const constructed = PromptConstructor.construct(context);
        const { prompt, imageUrls, warnings } = constructed;

        if (warnings.length > 0) {
            console.warn('[PayloadBuilderKling] Warnings:', warnings);
        }

        // 2. Image Handling
        const selectedImages = [...imageUrls];

        // OVERRIDE: Prioritize Explicit Images for Kling if present
        // User Request: "I don't want to remove chars and location... bc I may need to rerender in nano again."
        // Solution: If an Explicit Image (Ref Image) exists, force Kling to use THAT instead of the Character/Location image.
        if (context.explicitImages && context.explicitImages.length > 0) {
            console.log(`[PayloadBuilderKling] Explicit Priority Override: using ${context.explicitImages[0]}`);
            // Clearing the array and adding just the explicit one ensures it's the only one used.
            selectedImages.length = 0;
            selectedImages.push(context.explicitImages[0]);
        }

        if (selectedImages.length > 1) {
            console.warn(`[PayloadBuilderKling] Model requires exactly 1 image, but ${selectedImages.length} found. Using the first one.`);
            selectedImages.splice(1); // Keep only first
        } else if (selectedImages.length === 0) {
            console.warn('[PayloadBuilderKling] No input images found. Ensure this is intended for Text-to-Video fallback.');
        }

        // 3. Duration Logic
        // UI provides '5s' or '10s'. API expects "5" or "10".
        // Robustness: Handle "5 s", "5", "10s", etc.
        const rawDuration = (input.clip.duration || '5s').trim().toLowerCase().replace(/[^0-9]/g, '');
        const duration = rawDuration === '10' ? '10' : '5'; // Default strict to 5 if invalid or '5'

        // 4. Sound Logic (New)
        // input.sound comes from UI.
        const sound = !!input.sound; // Force boolean, default false

        // 5. Model ID
        const model = 'kling-2.6/image-to-video';

        return {
            model: model,
            input: {
                prompt: prompt,
                image_urls: selectedImages,
                sound: sound,
                duration: duration
            }
        };
    }
}
