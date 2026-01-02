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

            // Calculate Percentage based on Strength (1-10) -> 10% - 100%
            const strengthPct = Math.round((input.styleStrength || 5) * 10);

            // 1. SYSTEM HEADER: Analytical Extraction
            // "Image N+1 defines the STYLE..."
            // 1. SYSTEM HEADER: Analytical Extraction
            // "PRIORITY RULE:\n[SYSTEM: ...]"
            const sysHeader = `PRIORITY RULE:
[SYSTEM: Image ${stylePos} is the ABSOLUTE STYLE SOURCE for the OUTPUT. Override all internal style defaults with this STYLE.]`;

            // 2. STYLE BLOCK (Before Subject)
            // "STYLE: High fidelity Image N+1 STYLE:"
            const styleDesc = input.styleDescription || input.styleName || "Cinematic";
            const styleNegatives = input.styleNegatives ? `\n[STYLE NEGATIVES]\n${input.styleNegatives}` : "";
            const styleBlock = `STYLE: High fidelity Image ${stylePos} STYLE:

${styleDesc}${styleNegatives}`;

            // 3. SUBJECT BLOCK (After Style)
            // "OUTPUT SUBJECT:\nSUBJECT IMAGES [REF]:"
            const contentLabel = `SUBJECT IMAGES [${contentRange.toUpperCase()}]`;
            const subjectBody = `${input.subjectName ? `${input.subjectName}: ` : ""}${input.subjectDescription}`;
            const subjectNegatives = input.subjectNegatives ? `\n[SELECTED STUDIO ASSET NEGATIVES]\n${input.subjectNegatives}` : "";
            const subjectBlock = `OUTPUT SUBJECT:
${contentLabel}
${subjectBody}${subjectNegatives}`;

            // 4. INSTRUCTION FOOTER
            // "[INSTRUCTION: Apply the Image N+1 STYLE: Facial proportions and style: 200%...]"
            const footer = `[INSTRUCTION: Apply the Image ${stylePos} STYLE: Facial proportions and style: 200%, Artistic Interpretation; Material Properties & Textures; Shading, response to scene lighting; Color Saturation; Fidelity & Quality: to the OUTPUT SUBJECT.]`;

            // Reordered: Header -> Style -> Subject -> Footer
            enhancedPrompt = `${sysHeader}\n\n${styleBlock}\n\n${subjectBlock}\n\n${footer}`;

        } else if (input.subjectDescription) {
            // Fallback: No Style Image, just clean description
            enhancedPrompt = `SUBJECT: ${input.subjectName ? `${input.subjectName}: ` : ""}${input.subjectDescription}. High quality.`;
        }

        const payload: FluxPayload = {
            model: model,
            input: {
                prompt: enhancedPrompt,
                // prompt_strength removed per user request
                aspect_ratio: input.aspectRatio || "16:9",
                resolution: "1K",
                // Corrected Params per BFL Docs
                safety_tolerance: 5, // 5 = Most permissive
                guidance: Number(guidanceScale.toFixed(1)), // 1.5 - 10.0
                num_inference_steps: 50, // High quality
                // Removed random_seed as requested. Only pass seed if explicitly provided.
                ...(input.seed ? { seed: Number(input.seed) } : {}),
                ...(validImageUrls.length > 0 ? { input_urls: validImageUrls } : {})
            },
            // Removed root level seed fallback to avoid ambiguity
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
