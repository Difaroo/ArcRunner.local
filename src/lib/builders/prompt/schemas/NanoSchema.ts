
import { GenerationContext } from '../../PayloadBuilder';
import { PromptSchema, ImageManifest, PromptResult } from '../types';

/**
 * Nano Schema - Implements strict "Image N+1" style referencing.
 * 
 * Logic:
 * 1. Output Subject identified by Subject Images (1-N).
 * 2. Style defined by Image N+1 (if Style Asset exists).
 * 3. Structured breakdown: SETUP / REFERENCE, CAMERA, LOCATION, CHARACTERS, ACTION.
 */
export class NanoSchema implements PromptSchema {

    format(context: GenerationContext, manifest: ImageManifest): PromptResult {
        const { input, locationAsset, characterAssets, styleAsset, cameraAsset } = context;

        // --- 0. Collection of Negatives ---
        const negativeBlocks: string[] = [];

        // Style Negatives
        const styleNegs = styleAsset?.negatives || input.styleNegatives || "";
        if (styleNegs) negativeBlocks.push(styleNegs);

        // Location Negatives
        if (locationAsset?.negatives) negativeBlocks.push(locationAsset.negatives);

        // Character Negatives
        characterAssets.forEach(char => {
            if (char.negatives) negativeBlocks.push(char.negatives);
        });

        // Clip Negatives (Manual Override)
        const clipNegatives = input.clip.negativePrompt || "";
        if (clipNegatives) negativeBlocks.push(clipNegatives);

        // Default / Base Negatives (Safeguard)
        // negativeBlocks.push("low quality", "blurry", "bad anatomy"); // Optional: Add defaults here if desired?

        const finalNegativePrompt = negativeBlocks.join(', ');


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
            // Removed inline negatives

            prompt += `STYLE: High fidelity Image ${styleImageIndex} STYLE:\n\n`;
            prompt += `[${styleDesc}]\n`;
            prompt += `\n`;
        } else {
            // Fallback if no style image but style description exists
            if (input.styleDescription) {
                prompt += `STYLE: [${input.styleDescription}]\n\n`;
            }
        }

        // --- 2. Instruction ---
        if (hasStyleImage) {
            const strength = input.styleStrength || 5;
            prompt += `[INSTRUCTION: Preserve the identity and purpose of the OUTPUT SUBJECT. Apply the Image ${styleImageIndex} STYLE: Facial style: ${strength}, Artistic Interpretation; Material Properties & Textures; Shading, response to scene lighting; Fidelity & Quality: to the OUTPUT SUBJECT.]\n\n`;

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
            // Removed inline negatives
            prompt += `LOCATION: ${locationAsset.name}${imgRef}: [${locationAsset.description}].\n\n`;
        } else if (input.clip.location) {
            prompt += `LOCATION: ${input.clip.location}: [${input.clip.location}].\n\n`;
        }

        // Characters
        characterAssets.forEach((char, i) => {
            const charIndex = manifest.slots.characters[i];
            const charLinePrefix = charIndex > 0
                ? `CHARACTER: ${char.name}: ESSENTIAL: IMAGE ${charIndex}`
                : `CHARACTER: ${char.name}`;

            // Removed inline negatives
            prompt += `${charLinePrefix}: [${char.description}].\n\n`;
        });

        // Explicit References (for Studio items or additional refs)
        // These come from manifest.slots.references which are explicitImages that weren't claimed by characters
        if (manifest.slots.references && manifest.slots.references.length > 0) {
            manifest.slots.references.forEach((refIndex) => {
                if (refIndex > 0) {
                    // For Studio items, the item description goes here as the reference context
                    const refContext = input.subjectDescription || 'Reference for visual consistency';
                    prompt += `REFERENCE: ESSENTIAL: IMAGE ${refIndex}: [${refContext}].\n\n`;
                }
            });
        }

        prompt += `]\n\n`;

        // --- 4. Task/Action & Dialog ---
        // Detect Studio Item: Has subjectDescription but no action
        const isStudioItem = !input.clip.action && input.subjectDescription;
        const taskLabel = isStudioItem ? 'TASK' : 'ACTION';

        const actionText = input.clip.action || input.subjectDescription || "";
        const dialogText = input.clip.dialog ? `${input.clip.dialog}` : "";

        let unifiedAction = actionText;
        if (dialogText) {
            unifiedAction += `\n\n${dialogText}`;
        }

        // ADHERENCE BOOSTER 2: Inject Image References into Action
        characterAssets.forEach((char, i) => {
            const charIndex = manifest.slots.characters[i];
            if (charIndex > 0 && char.name) {
                const regex = new RegExp(`\\b${char.name}\\b`, 'gi');
                unifiedAction = unifiedAction.replace(regex, `${char.name} (IMAGE ${charIndex})`);
            }
        });

        prompt += `${taskLabel}: [${unifiedAction}]\n`;
        prompt += `shot.\n`;

        // --- 6. Footer ---
        if (hasStyleImage) {
            const footerLabel = isStudioItem ? 'TASK' : 'ACTION';
            prompt += `\n[OUTPUT: Render ${footerLabel} with strict adherence to STYLE REFERENCE.]`;
        }

        return {
            prompt,
            negativePrompt: finalNegativePrompt
        };
    }
}
