import { PayloadBuilder, GenerationContext } from './PayloadBuilder';
import { VeoPayload } from '@/lib/kie-types';

export class PayloadBuilderVeo implements PayloadBuilder {

    supports(modelId: string): boolean {
        // Legacy: 'veo', 'veo-2', 'veo-fast' all map to this builder
        return modelId.startsWith('veo');
    }

    build(context: GenerationContext): VeoPayload {
        try {
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
                // NOTE: For S2E (2 images), this means End Frame is treated as "Style".
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
            if (input.model === 'veo-s2e') {
                // S2E requires 2 images (Start & End)
                if (validImageUrls.length >= 2) {
                    payload.imageUrls = validImageUrls.slice(0, 2); // Strict: Top 2
                    payload.generationType = 'IMAGE_TO_VIDEO';
                } else if (validImageUrls.length === 1) {
                    console.warn('[PayloadBuilderVeo] S2E requested but only 1 image found. Falling back to REFERENCE_2_VIDEO.');
                    // Determine user intent here. If they selected S2E but only have 1 image,
                    // do we fall back to Ref-2-Video (Image 1->Start) or Text?
                    // Logic: "Ref 2 Video" is better than failure.
                    payload.imageUrls = validImageUrls;
                    payload.generationType = 'REFERENCE_2_VIDEO';
                } else {
                    console.warn('[PayloadBuilderVeo] S2E requested but 0 images found. Falling back to TEXT_2_VIDEO.');
                    // 0 Images -> Fallback to Text
                    payload.generationType = 'TEXT_2_VIDEO';
                }
            } else if (validImageUrls.length > 0) {
                payload.imageUrls = validImageUrls;
                payload.generationType = 'REFERENCE_2_VIDEO';
            } else {
                payload.generationType = 'TEXT_2_VIDEO';
            }

            // Safety: ensure duration is valid string '5' or '10'?
            if (payload.durationType !== '5' && payload.durationType !== '10') {
                payload.durationType = '5';
            }

            return payload;

        } catch (error) {
            console.error('[PayloadBuilderVeo] Critical Error building payload:', error);
            // Emergency Fallback to prevent crash
            // Return a minimal valid payload to allow error to propagate from API rather than Client crash
            return {
                model: 'veo3_fast',
                prompt: context.input.styleDescription || "Emergency Fallback Prompt",
                generationType: 'TEXT_2_VIDEO', // Safe default
                aspectRatio: '16:9',
                durationType: '5'
            };
        }
    }
}
