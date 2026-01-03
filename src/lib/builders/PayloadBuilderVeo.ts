import { PayloadBuilder, GenerationContext } from './PayloadBuilder';
import { VeoPayload } from '@/lib/kie-types';

export class PayloadBuilderVeo implements PayloadBuilder {

    supports(modelId: string): boolean {
        // Legacy: 'veo', 'veo-2', 'veo-fast' all map to this builder
        return modelId.startsWith('veo');
    }

    build(context: GenerationContext): VeoPayload {
        const { input, publicImageUrls } = context;

        // --- DEFENSIVE: Resolve Resources ---
        // Ensure strictly valid URLs (http/data). Filter out internal placeholders if any.
        const validImageUrls = (publicImageUrls || []).filter(url =>
            url && !url.startsWith('TASK:') && (url.startsWith('http') || url.startsWith('data:'))
        );

        // --- STEP 1: Resolve Descriptions (Fail-Safe Defaults) ---
        // Prioritize computed descriptions from Manager, fallback to raw Clip data
        const styleDesc = input.styleDescription || input.styleName || input.clip.style || "Cinematic";
        const styleNegs = input.styleNegatives || "";

        // Construct Subject Description if not pre-computed
        const subjectDesc = input.subjectDescription ||
            `${input.clip.character || ""} ${input.clip.action || ""} at ${input.clip.location || ""}. ${input.clip.camera || ""} shot.`;
        const subjectNegs = input.subjectNegatives || "";

        // --- STEP 2: Logic - Dynamic Numbering (Nano Parity) ---
        // Calculate which image index defines the Style vs Content
        const styleIdx = input.styleImageIndex;
        let stylePos = "N+1";
        let contentRange = "1-N";

        if (styleIdx !== undefined && styleIdx >= 0) {
            // Explicit index provided
            const n = styleIdx;
            stylePos = `Image ${n + 1}`;
            contentRange = n > 0 ? (n === 1 ? "Image 1" : `Images 1-${n}`) : "None";
        } else if (validImageUrls.length > 1) {
            // Auto-detect: If >1 image, assume last one (or 2nd) is style? 
            // Matching Nano logic: Assume Input[Last] is style for now.
            stylePos = `Image ${validImageUrls.length}`;
            contentRange = validImageUrls.length > 1 ? `Images 1-${validImageUrls.length - 1}` : "Image 1";
        }

        // Strength Calculation (1-10 -> 10-100%)
        const strengthPct = Math.round((input.styleStrength || 5) * 10);

        // --- STEP 3: Prompt Construction (Rich Template) ---
        // Using "Hardcoded Pro" template from Nano for consistency
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

        // Fallback: If description components were empty/invalid, revert to basic prompt?
        // Actually, the template handles empty values gracefully via defaults above.
        // Safety check: specific length limit? Veo might have one.
        if (finalPrompt.length > 5000) {
            console.warn('[PayloadBuilderVeo] Prompt too long, truncating to 5000 chars.');
            finalPrompt = finalPrompt.substring(0, 4997) + '...';
        }

        // --- STEP 4: Payload Assembly ---
        const payload: VeoPayload = {
            model: 'veo3_fast', // Strict match user requirement
            prompt: finalPrompt,
            aspectRatio: input.aspectRatio || '16:9',
            durationType: input.clip.duration || '5',
            enableTranslation: true,
            enableFallback: true
        };

        // Attach Images (Defensive Check)
        if (validImageUrls.length > 0) {
            payload.imageUrls = validImageUrls;
            payload.generationType = 'REFERENCE_2_VIDEO';
        } else {
            payload.generationType = 'TEXT_2_VIDEO';
        }

        // console.log('[PayloadBuilderVeo] Built Payload with Nano Logic.', { images: validImageUrls.length, promptLen: finalPrompt.length });

        return payload;
    }
}
