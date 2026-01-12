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
        const { prompt, negativePrompt, imageUrls, warnings } = constructed;

        // Re-inject Negatives inline for Kling (not supported in payload)
        let finalPrompt = prompt;
        if (negativePrompt) {
            finalPrompt += `\n\nNO: [${negativePrompt}].`;
        }

        if (warnings.length > 0) {
            console.warn('[PayloadBuilderKling] Warnings:', warnings);
        }

        // 2. Image Handling
        // STRICT REQUIREMENT: Kling only uses EXPLICIT Reference Images.
        // It does NOT use implied Character/Location images from the Studio.
        const selectedImages: string[] = [];

        // User Request: "I don't want to remove chars and location... bc I may need to rerender in nano again."
        // Solution: If an Explicit Image (Ref Image) exists, force Kling to use THAT instead of the Character/Location image.

        // Robustness: Filter out empty strings that might creep in from "zombie" references or UI artifacts
        const validExplicit = (context.explicitImages || [])
            .filter(u => u && u.trim().length > 0);

        if (validExplicit.length > 0) {
            console.log(`[PayloadBuilderKling] Using Explicit Reference: ${validExplicit[0]}`);
            selectedImages.push(validExplicit[0]);
        } else {
            // If no explicit image, we CANNOT proceed.
            console.warn('[PayloadBuilderKling] No Explicit Reference Image found (filtered empty).');
            throw new Error('Kling requires a Manual Reference Image (Sideload/Paste). Studio Defaults (Characters/Locations) are not supported for this model.');
        }

        // Just sanity check, though logic above guarantees 1
        if (selectedImages.length > 1) {
            console.warn(`[PayloadBuilderKling] Multiple explicit images found? Using first only.`);
            selectedImages.splice(1);
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

        // 6. Prompt Safety (Truncation)
        // Kling 2.6 has a strict limit (approx 2000-2500 chars).
        // StandardSchema can be very verbose (Bios + Style + Instructions).
        // We truncate to 2000 to be safe.
        // We truncate to 2000 to be safe.
        const MAX_KLING_CHARS = 2000;
        if (finalPrompt.length > MAX_KLING_CHARS) {
            console.warn(`[PayloadBuilderKling] Prompt too long (${finalPrompt.length} chars). Performing Smart Truncation.`);

            // Smart Truncate: Preserve HEAD (Style/Subject) and TAIL (Action). Squeeze the Middle (Bios).
            const HEAD_SIZE = 1200; // Style + Subject + Location
            const TAIL_SIZE = 500;  // Action + Footer

            if (finalPrompt.length > (HEAD_SIZE + TAIL_SIZE)) {
                const head = finalPrompt.slice(0, HEAD_SIZE);
                const tail = finalPrompt.slice(finalPrompt.length - TAIL_SIZE);
                finalPrompt = `${head}\n... [TRUNCATED CONTEXT] ...\n${tail}`;
            } else {
                // Fallback if slightly over but within squeeze range (unlikely given math above)
                finalPrompt = finalPrompt.slice(0, MAX_KLING_CHARS);
            }
        }

        const payload = {
            model: model,
            input: {
                prompt: finalPrompt || "Video", // Fallback
                image_urls: selectedImages,
                sound: sound,
                duration: duration
            }
        };
        console.log('[PayloadBuilderKling] Final Payload:', JSON.stringify(payload, null, 2));
        return payload;
    }
}
