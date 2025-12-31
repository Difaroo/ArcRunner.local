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

        // 2. Build Prompt (Advanced Structured Format)
        // We now expect input.subjectDescription and input.styleDescription from route.ts
        // If legacy prompt is passed, we fallback to it.
        let enhancedPrompt = input.prompt || "";

        // 3. Resolve Resources
        // validImageUrls: filtered public URLs
        const validImageUrls = (publicImageUrls || [])
            .filter(url => url && !url.startsWith('TASK:') && (url.startsWith('http') || url.startsWith('data:')));

        // 4. Calculate Guidance
        // User Range: 1-10
        // API Range: 1.5 - 10.0 (Full Scale)
        const styleStrength = input.styleStrength || 5;
        const guidanceScale = 1.5 + ((styleStrength - 1) * (8.5 / 9));

        // Detect Style Mode
        const styleIdx = input.styleImageIndex;
        const hasStyleImage = styleIdx !== undefined && styleIdx >= 0 && validImageUrls.length > styleIdx;

        // Only trigger "Sandwich" mode if we have distinct components AND a style image
        if (input.subjectDescription && hasStyleImage) {
            const n = styleIdx!; // Index usage safe due to check above

            const stylePos = n + 1; // "Image 2"
            const contentRange = n > 0 ? (n === 1 ? "Image 1" : `Images 1-${n}`) : "None";

            // 1. SYSTEM HEADER
            // Optimized with weights and repetition
            const sysHeader = `[System: Image ${stylePos} is the STYLE REFERENCE. (Apply the precise artistic style, brushwork, and color palette from Image ${stylePos}:1.3) to the content of ${contentRange}. IGNORE the subject of Image ${stylePos}.]`;

            // 2. SUBJECT BLOCK
            const subjectBlock = `OUTPUT SUBJECT:\n${contentRange !== "None" ? `${contentRange.toUpperCase()}: ` : ""}${input.subjectName ? `${input.subjectName}: ` : ""}${input.subjectDescription}`;

            // 3. STYLE BLOCK
            // Repetition for emphasis
            const styleDesc = input.styleDescription || input.styleName || "Cinematic";
            const styleBlock = `STYLE [IMAGE ${stylePos}]:\n(Exactly match Image ${stylePos}'s rendering and texture:1.2). ${styleDesc}`;

            // 4. INSTRUCTION FOOTER
            const footer = `[Instruction: Render the SUBJECT defined above using the STYLE defined above. Apply the style from Image ${stylePos} to the Subject from ${contentRange}.]`;

            enhancedPrompt = `${sysHeader}\n\n${subjectBlock}\n\n${styleBlock}\n\n${footer}`;

        } else if (input.subjectDescription) {
            // Fallback: No Style Image, just clean description
            enhancedPrompt = `SUBJECT: ${input.subjectName ? `${input.subjectName}: ` : ""}${input.subjectDescription}. High quality.`;
        }

        const payload: FluxPayload = {
            model: model,
            input: {
                prompt: enhancedPrompt,
                // prompt_strength removed per user request (unsupported by Flux)
                aspect_ratio: input.aspectRatio || "16:9",
                resolution: "1K",
                // Corrected Params per BFL Docs
                safety_tolerance: 5, // 5 = Most permissive
                guidance: Number(guidanceScale.toFixed(1)), // 1.5 - 10.0
                num_inference_steps: 50, // High quality
                // Dual-send seed to handle potential API parameter naming variance (seed vs random_seed)
                ...(input.seed ? {
                    seed: Number(input.seed),
                    random_seed: Number(input.seed)
                } : {}),
                ...(validImageUrls.length > 0 ? { input_urls: validImageUrls } : {})
            },
            ...(input.seed ? { seed: Number(input.seed) } : {}) // Root level fallback
        };

        // VISUAL CONFIG LOG FOR DEBUGGING AND TUNING
        console.log('[FluxPayload] Config:', {
            prompt: enhancedPrompt.substring(0, 100) + '...',
            guidance: payload.input.guidance,
            steps: payload.input.num_inference_steps,
            seed: payload.input.seed || 'RANDOM'
        });

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
