
import { GenerationContext } from '../../PayloadBuilder';
import { PromptSchema, ImageManifest } from '../types';

/**
 * Nano Schema - Implements strict "Image N+1" style referencing.
 * 
 * Logic:
 * 1. Output Subject identified by Subject Images (1-N).
 * 2. Style defined by Image N+1 (if Style Asset exists).
 * 3. Structured breakdown: SETUP / REFERENCE, CAMERA, LOCATION, CHARACTERS, ACTION.
 */
export class NanoSchema implements PromptSchema {

    format(context: GenerationContext, manifest: ImageManifest): string {
        const { input, locationAsset, characterAssets, styleAsset, cameraAsset } = context;

        // --- 1. Header & Priority Rule ---
        let prompt = ``;

        // Determine if we have a STYLE asset image (Image N+1)
        const hasStyleImage = manifest.slots.style > 0 && manifest.slots.style <= manifest.selectedUrls.length;
        const styleImageIndex = manifest.slots.style;

        if (hasStyleImage) {
            prompt += `[SYSTEM: PRIORITY RULE:\n`;
            prompt += `Image ${styleImageIndex} defines the STYLE for the OUTPUT.\n`;
            prompt += `IGNORE the subject of Image ${styleImageIndex}.\n`;
            prompt += `]\n\n`;

            const styleDesc = styleAsset?.description || input.styleDescription || "Cinematic";
            const styleNegs = styleAsset?.negatives || input.styleNegatives || "";

            prompt += `STYLE: High fidelity Image ${styleImageIndex} STYLE:\n\n`;
            prompt += `[${styleDesc}]\n`;
            if (styleNegs) prompt += `[${styleNegs}]\n`;
            prompt += `\n`;
        } else {
            // Fallback if no style image but style description exists
            if (input.styleDescription) {
                prompt += `STYLE: [${input.styleDescription}]\n\n`;
            }
        }

        // --- 2. Instruction ---
        if (hasStyleImage) {
            prompt += `[INSTRUCTION: Preserve the identity and purpose of the OUTPUT SUBJECT. Apply the Image ${styleImageIndex} STYLE: Facial style, Artistic Interpretation; Material Properties & Textures; Shading, response to scene lighting; Fidelity & Quality: to the OUTPUT SUBJECT.]\n\n`;

            // Conditional Style Asset Block
            if (styleAsset) {
                prompt += `[SYSTEM: PRIORITY RULE: \n\n`;
                prompt += `OUTPUT WITH STYLE REFERENCE:\n`;
                prompt += `{if STYLE ASSET IMAGE: [Defined by STYLE of IMAGE ${styleImageIndex}: Facial style, Artistic Interpretation; Material Properties & Textures; Response to scene lighting; Fidelity & Quality]}\n`;
                if (styleAsset.description) prompt += `[${styleAsset.description}]\n`;
                prompt += `]}\n\n`;
            }
        }

        // --- 3. Setup / Reference ---
        prompt += `SETUP / REFERENCE:\n[\n`;

        // Camera
        const camDesc = cameraAsset?.description || input.clip.camera;
        if (camDesc) {
            prompt += `CAMERA: [${camDesc}]\n\n`;
        }

        // Location
        if (locationAsset) {
            const locIndex = manifest.slots.location;
            const imgRef = locIndex > 0 ? `: IMAGE ${locIndex}` : "";
            prompt += `LOCATION: ${locationAsset.name}${imgRef}: [${locationAsset.description}].\n`;
            if (locationAsset.negatives) prompt += `NO: [${locationAsset.negatives}]\n`;
            prompt += `\n`;
        } else if (input.clip.location) {
            prompt += `LOCATION: ${input.clip.location}: [${input.clip.location}].\n\n`;
        }

        // Characters
        characterAssets.forEach((char, i) => {
            const charIndex = manifest.slots.characters[i];

            // Refined Logic based on User Request:
            // "CHARACTER: Name: ESSENTIAL: IMAGE X: [Description]."

            let charLinePrefix = `CHARACTER: ${char.name}`;

            if (charIndex > 0) {
                charLinePrefix += `: ESSENTIAL: IMAGE ${charIndex}`;
            }

            prompt += `${charLinePrefix}: [${char.description}].\n`;

            if (char.negatives) prompt += `NO: [${char.negatives}].\n`;
            prompt += `\n`;
        });

        prompt += `]\n\n`;

        // --- 4. Action & Dialog ---
        const actionText = input.clip.action || "";
        const dialogText = input.clip.dialog ? `${input.clip.dialog}` : "";

        let unifiedAction = actionText;
        if (dialogText) {
            unifiedAction += `\n\n${dialogText}`;
        }

        // ADHERENCE BOOSTER 2: Inject Image References into Action
        characterAssets.forEach((char, i) => {
            const charIndex = manifest.slots.characters[i];
            if (charIndex > 0 && char.name) {
                // Regex to replace Name with Name (IMAGE X)
                // Case insensitive, matching word boundary
                const regex = new RegExp(`\\b${char.name}\\b`, 'gi');
                unifiedAction = unifiedAction.replace(regex, `${char.name} (IMAGE ${charIndex})`);
            }
        });

        prompt += `ACTION: [${unifiedAction}]\n`;
        prompt += `shot.\n`;

        // --- 5. Clip Negatives ---
        const clipNegatives = input.clip.negativePrompt || "";
        if (clipNegatives) {
            prompt += `NO: [${clipNegatives}].\n`;
        }

        // --- 6. Footer ---
        if (hasStyleImage) {
            prompt += `\n[OUTPUT: Render ACTION with strict adherence to STYLE REFERENCE.]`;
        }

        return prompt;
    }
}
