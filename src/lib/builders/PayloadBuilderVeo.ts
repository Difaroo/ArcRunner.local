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
        // --- STEP 1: Resolve Descriptions ---
        // Prioritize computed descriptions from Manager. 
        // NOTE: Remove "Cinematic" default to support No-Style mode per user request.
        const styleDesc = input.styleDescription || input.styleName || input.clip.style;
        const styleNegs = input.styleNegatives || "";
        const hasStyle = !!styleDesc && styleDesc.trim().length > 0; // Check effective style existence

        // Construct Subject Description if not pre-computed
        const subjectDesc = input.subjectDescription ||
            `${input.clip.character || ""} ${input.clip.action || ""} at ${input.clip.location || ""}. ${input.clip.camera || ""} shot.${input.clip.dialog ? `\nDIALOGUE: ${input.clip.dialog}` : ""}`;
        const subjectNegs = input.subjectNegatives || "";

        // --- STEP 2: Logic - Dynamic Numbering ---
        const totalImages = validImageUrls.length;
        let stylePos = "N+1"; // Default invalid if not used
        let contentRange = "Images 1-N";
        let subjectLabel = "SUBJECT IMAGES";

        if (hasStyle && totalImages > 1) {
            // Standard Style Reference Logic
            const styleIdx = input.styleImageIndex;

            // Calculate Range End
            const endIdx = (styleIdx !== undefined && styleIdx >= 0) ? styleIdx : totalImages - 1;

            if (endIdx === 0) {
                contentRange = "None"; // Should not happen often if total > 1
                subjectLabel = "SUBJECT IMAGES";
            } else if (endIdx === 1) {
                contentRange = "Image 1";
                subjectLabel = "SUBJECT IMAGE 1:";
            } else {
                contentRange = `Images 1-${endIdx}`;
                subjectLabel = `SUBJECT IMAGES 1-${endIdx}`; // "SUBJECT IMAGES 1, 2" format requested? 
                // User asked: "SUBJECT IMAGES 1, 2". Range is "1-2".
                // Let's stick to "Images 1-X" format for the variable, but the Label prefix depends.
                // User: "should say 'SUBJECT IMAGE 1:' OR ... 'SUBJECT IMAGES 1, 2'"
                // Let's format the label line explicitly below.
            }

            stylePos = `Image ${totalImages}`; // Default last
            if (styleIdx !== undefined && styleIdx >= 0) {
                stylePos = `Image ${styleIdx + 1}`;
            }

        } else {
            // No Style / All Subject
            if (totalImages === 1) {
                contentRange = "Image 1";
                subjectLabel = "SUBJECT IMAGE 1:";
            } else {
                contentRange = `Images 1-${totalImages}`;
                subjectLabel = `SUBJECT IMAGES 1-${totalImages}`; // Or comma separated? Range is safer for variable length.
            }
        }

        const strengthPct = Math.round((input.styleStrength || 5) * 30); // Boost to 150% (5 * 30)

        // --- STEP 3: Prompt Construction (Rich Template) ---
        const lines = [];

        if (hasStyle) {
            lines.push(
                `[SYSTEM: PRIORITY RULE:`,
                `${stylePos} defines the STYLE for the OUTPUT.`,
                `IGNORE the subject of ${stylePos}.`,
                `]`,
                ``,
                `STYLE: High fidelity ${stylePos} STYLE:`,
                ``,
                `[${styleDesc} ${styleNegs}]`, // Merged Negatives
                ``
            );
        }

        if (hasStyle) {
            lines.push(
                `[INSTRUCTION: Preserve the identity and purpose of the OUTPUT SUBJECT. Apply the ${stylePos} STYLE: Facial style: 150%, Artistic Interpretation; Material Properties & Textures; Shading, response to scene lighting; Fidelity & Quality: to the OUTPUT SUBJECT.]`
            );
        } else {
            lines.push(
                `[INSTRUCTION: Preserve the identity and purpose of the OUTPUT SUBJECT. Render with high fidelity and adherence to prompt description.]`
            );
        }

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
            durationType: (input.clip as any).duration || '5',
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
