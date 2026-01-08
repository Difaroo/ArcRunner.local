import { GenerationContext } from '../../PayloadBuilder';
import { ImageManifest, PromptSchema } from '../types';

export class StandardSchema implements PromptSchema {

    format(context: GenerationContext, manifest: ImageManifest): string {
        const { input, locationAsset, characterAssets, styleAsset, cameraAsset } = context;
        const blocks: string[] = [];

        // --- 1. Header (Style System) ---
        const hasStyle = !!(styleAsset || input.styleName || input.styleDescription);
        const styleDesc = styleAsset?.description || input.styleDescription || input.styleName || "Cinematic";

        if (hasStyle) {
            let styleDef = `[STYLE ASSET DESCRIPTION: ${styleDesc}]`;

            // If Style Image exists (check manifest slot)
            if (manifest.slots.style > 0) {
                const idx = manifest.slots.style;
                // Dynamic strength from input
                const strength = Math.round((input.styleStrength || 5) * 10) + 100;
                styleDef = `[Defined by STYLE of IMAGE ${idx}: Facial style: ${strength}%, Artistic Interpretation; Material Properties & Textures; Response to scene lighting; Fidelity & Quality]\n${styleDef}`;
            }

            blocks.push(`[SYSTEM: PRIORITY RULE:\n\nOUTPUT WITH STYLE REFERENCE:\n${styleDef}\n]`);
        }

        // --- 2. Setup / Reference Block ---
        const setupLines: string[] = [];

        // Camera
        const camDesc = cameraAsset?.description || input.clip.camera;
        if (camDesc) setupLines.push(`CAMERA: [${camDesc}]`);

        // Location
        const locName = locationAsset?.name || input.clip.location || "Location";
        const locDesc = locationAsset?.description || "";
        const locNegs = locationAsset?.negatives ? `\nNO: [${locationAsset.negatives}]` : "";

        const locImgIdx = manifest.slots.location;
        const locImgTag = locImgIdx > 0 ? `IMAGE ${locImgIdx}: ` : "";

        setupLines.push(`LOCATION: ${locName}: ${locImgTag}[${locDesc || locName}].${locNegs}`);

        // Characters
        const charNames = input.clip.character ? input.clip.character.split(',').map(s => s.trim()) : [];
        const maxChars = Math.max(characterAssets.length, charNames.length);

        for (let i = 0; i < maxChars; i++) {
            const asset = characterAssets[i];
            const name = asset?.name || charNames[i] || `Character ${i + 1}`;
            const desc = asset?.description || name;
            const negs = asset?.negatives ? `\nNO: [${asset.negatives}]` : "";

            // Get slot from manifest
            const imgIdx = manifest.slots.characters[i] || 0;
            const imgTag = imgIdx > 0 ? `IMAGE ${imgIdx}: ` : "";

            setupLines.push(`CHARACTER: ${name}: ${imgTag}[${desc}].${negs}`);
        }

        // Explicit Refs
        manifest.slots.references.forEach((idx, i) => {
            setupLines.push(`REF IMAGE ${i + 1}: IMAGE ${idx}: [Additional Reference].`);
        });

        if (setupLines.length > 0) {
            blocks.push(`SETUP / REFERENCE:\n[\n${setupLines.join('\n\n')}\n]`);
        }

        // --- 3. Action Block ---
        const actionText = input.clip.action || "";
        const dialogText = input.clip.dialog ? ` Character says: "${input.clip.dialog}"` : "";
        const clipNegs = input.subjectNegatives || "";

        blocks.push(`ACTION: [${actionText}]. [${dialogText}]\nshot.`);
        if (clipNegs) {
            blocks.push(`NO: [${clipNegs}].`);
        }

        // --- 4. Footer ---
        if (hasStyle) {
            blocks.push(`[OUTPUT: Render ACTION with strict adherence to STYLE REFERENCE.]`);
        }

        return blocks.join('\n\n');
    }
}
