import { GenerationContext } from '../../PayloadBuilder';
import { ImageManifest, PromptSchema, PromptResult } from '../types';

export class KlingSchema implements PromptSchema {

    format(context: GenerationContext, manifest: ImageManifest): PromptResult {
        const { input, styleAsset } = context;
        const blocks: string[] = [];

        // --- 1. Style (Brief) ---
        // Just the name or brief description, no negatives or complex instructions.
        const styleDesc = styleAsset?.description || input.styleDescription || input.styleName;
        if (styleDesc) {
            blocks.push(`STYLE: [${styleDesc}]`);
        }

        // --- 2. Action (The Core) ---
        const actionText = input.clip.action || "Video";
        const dialogText = input.clip.dialog ? ` Character says: "${input.clip.dialog}"` : "";

        blocks.push(`ACTION: [${actionText}]. [${dialogText}]`);

        // --- 3. Camera ---
        const camDesc = context.cameraAsset?.description || input.clip.camera;
        if (camDesc) blocks.push(`CAMERA: [${camDesc}]`);

        // --- 4. Validation / Footer ---
        // No redundant character bios or location bios.
        // The Reference Image supplies the visual data.

        return {
            prompt: blocks.join('\n\n'),
            negativePrompt: input.clip.negativePrompt || ""
        };
    }
}
