import { PayloadBuilder, GenerationContext } from './PayloadBuilder';
import { GenerateTaskInput } from '@/lib/generate-manager';

// Define Nano-specific payload types here until we consolidate in kie-types
interface NanoPayload {
    model: string;
    callBackUrl?: string; // Optional but good practice
    input: {
        prompt: string;
        image_input?: string[]; // "array(URL)"
        aspect_ratio?: string;
        resolution?: string;
        output_format?: string;
    };
}

export class PayloadBuilderNano implements PayloadBuilder {

    supports(modelId: string): boolean {
        // Explicitly support 'nano-banana-pro' and flexible checks
        return modelId.includes('nano') || modelId.includes('banana');
    }

    build(context: GenerationContext): NanoPayload {
        const { input, publicImageUrls } = context;

        // 1. Resolve Model Name
        const model = input.model && input.model.includes('nano') ? input.model : 'nano-banana-pro';

        // 2. Resolve Resources
        const validImageUrls = (publicImageUrls || [])
            .filter(url => url && !url.startsWith('TASK:') && (url.startsWith('http') || url.startsWith('data:')));


        // 3. Resolve Descriptions & Negatives
        const styleDesc = input.styleDescription || input.styleName || input.clip.style || "Cinematic";
        const styleNegs = input.styleNegatives || "";

        const subjectDesc = input.subjectDescription ||
            `${input.clip.character || ""} ${input.clip.action || ""} at ${input.clip.location || ""}. ${input.clip.camera || ""} shot.`;
        const subjectNegs = input.subjectNegatives || "";

        // 4. Calculate Dynamic Numbering (Copied from Flux Builder)
        // Default to "Image 2 defines Style" if we have >1 image and an index is provided
        const styleIdx = input.styleImageIndex;
        // If undefined, assume Last Image is Style? Or hardcode N+1 behavior?
        // Flux checks: styleIdx !== undefined && validImageUrls.length > styleIdx
        // For Nano PRO, we assume strict adherence to the input images array.

        let stylePos = "N+1";
        let contentRange = "1-N";

        if (styleIdx !== undefined && styleIdx >= 0) {
            const n = styleIdx;
            stylePos = `Image ${n + 1}`;
            contentRange = n > 0 ? (n === 1 ? "Image 1" : `Images 1-${n}`) : "None";
        } else if (validImageUrls.length > 1) {
            // Fallback: Assume last image is style? Or Image 2?
            // Let's assume input[1] is style (Pos 2) if 2 images present
            stylePos = `Image ${validImageUrls.length}`;
            contentRange = validImageUrls.length > 1 ? `Images 1-${validImageUrls.length - 1}` : "Image 1";
        }

        const strengthPct = Math.round((input.styleStrength || 5) * 10); // 1-10 -> 10-100%

        // 5. Build Prompt (User's "Hardcoded Pro" Template with Dynamic Variables)
        const lines = [
            `[SYSTEM: PRIORITY RULE:`,
            `${stylePos} defines the STYLE for the OUTPUT.`,
            `IGNORE the subject of ${stylePos}.`,
            `]`,
            ``,
            `STYLE: High fidelity ${stylePos} STYLE:`,
            ``,
            `[${styleDesc}]`,
            `[${styleNegs}]`,
            ``,
            `OUTPUT SUBJECT:`,
            `SUBJECT IMAGES [SUBJECT STUDIO ASSET REF IMAGES ${contentRange}]`,
            `[${subjectDesc}]`,
            `[${subjectNegs}]`,
            ``,
            `[INSTRUCTION: Preserve the identity and purpose of the OUTPUT SUBJECT. Apply the ${stylePos} STYLE: Facial style: ${strengthPct}%, Artistic Interpretation; Material Properties & Textures; Shading, response to scene lighting; Fidelity & Quality: to the OUTPUT SUBJECT.]`
        ];

        let finalPrompt = lines.join('\n');

        // Safety truncating
        if (finalPrompt.length > 20000) {
            finalPrompt = finalPrompt.substring(0, 19997) + '...';
        }

        // 6. Construct Payload
        const payload: NanoPayload = {
            model: model,
            input: {
                prompt: finalPrompt,
                image_input: validImageUrls.length > 0 ? validImageUrls : undefined,
                aspect_ratio: input.aspectRatio || "16:9",
                resolution: "1K",
                output_format: "png"
            }
        };

        // Debug Log
        console.log('[NanoPayload] Built:', {
            model,
            promptLen: finalPrompt.length,
            images: validImageUrls.length,
            stylePos,
            contentRange,
            strengthPct
        });

        return payload;
    }
}
