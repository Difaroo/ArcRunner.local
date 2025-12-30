import { PayloadBuilder, GenerationContext } from './PayloadBuilder';
import { FluxPayload } from '@/lib/kie-types';

export class PayloadBuilderFlux implements PayloadBuilder {

    supports(modelId: string): boolean {
        return modelId.includes('flux');
    }

    build(context: GenerationContext): FluxPayload {
        const { input, publicImageUrls } = context;

        // 1. Resolve Model Name
        let model = input.model || 'flux-2/flex-image-to-image';
        if (model === 'flux' || model === 'flux-pro') model = 'flux-2/flex-image-to-image';

        // 2. Build Prompt (if not already in input)
        // Prefer input.prompt (direct override), else construct from clip
        const prompt = input.prompt || this.buildPrompt(input.clip);

        // 3. Aggregate Reference Images
        // Aggregates:
        // - publicImageUrls (passed from GenerateManager, containing Clip refs)
        // - context.styleRef (if passed from specialized callers like Studio API, though ideally should be merged upstream) -> To be safe, we assume upstream merges into publicImageUrls?
        // Actually, the Plan says "flux passes image_ref_urls".
        // GenerateManager resolves publicImageUrls from clip refs.
        // Studio API resolves publicImageUrls from Style + Clip refs.
        // So `publicImageUrls` IS the single source of truth here.

        const validImageUrls = (publicImageUrls || [])
            .filter(url => url && !url.startsWith('TASK:') && (url.startsWith('http') || url.startsWith('data:')));

        // 4. Construct Payload
        // Fallback: If no images, we must use a Text-to-Image model.
        // Fallback: If no images, we must use a Text-to-Image model.
        if (validImageUrls.length === 0) {
            // Use the specific Text-to-Image model found in the docs
            model = 'flux-2/flex-text-to-image';
        }

        const payload: FluxPayload = {
            model: model,
            input: {
                prompt: prompt,
                aspect_ratio: input.aspectRatio || "16:9",
                resolution: "2K",
                disable_safety_checker: true,
                // Smart Logic: Only include input_urls if present.
                // If present -> Flux acts as Image-to-Image / Style Transfer
                // If empty -> Text-to-Image
                ...(validImageUrls.length > 0 ? { input_urls: validImageUrls } : {})
            }
        };

        return payload;
    }

    private buildPrompt(clip: any): string {
        if (!clip) return "Cinematic shot";

        // Basic prompt construction mirroring GenerateManager logic
        // We can enhance this later with a dedicated PromptBuilder if needed
        const parts = [
            "Cinematic shot.",
            clip.action,
            clip.dialog ? `Character says: "${clip.dialog}"` : null,
            clip.style,
            clip.camera,
            "High quality."
        ];

        return parts.filter(Boolean).join(' ');
    }
}
