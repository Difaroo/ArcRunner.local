import { GenerationContext } from '../../PayloadBuilder';
import { ImageManifest, PromptSchema } from '../types';

export class StandardSchema implements PromptSchema {

    format(context: GenerationContext, manifest: ImageManifest): string {
        const { input, locationAsset, characterAssets, styleAsset, cameraAsset } = context;
        const blocks: string[] = [];

        // --- 0. Pre-Calculation (Indices) ---
        // "N+1" is the Style Index.
        // "N" is the count of Subject Images.
        const styleIdx = manifest.slots.style;
        const hasStyleImage = styleIdx > 0;
        const hasStyle = !!(styleAsset || input.styleName || input.styleDescription);

        // --- 1. System Priority Rule (Header) ---
        if (hasStyle) {
            let header = `[SYSTEM: PRIORITY RULE:\n`;
            if (hasStyleImage) {
                header += `Image ${styleIdx} defines the STYLE for the OUTPUT.\n`;
                header += `IGNORE the subject of Image ${styleIdx}.\n`;
            } else {
                // Fallback for Text-Only Style (No Image N+1)
                header += `Follow the STYLE DESCRIPTION strictly.\n`;
            }
            header += `]`;
            blocks.push(header);
        }

        // --- 2. Style Block ---
        const styleDesc = styleAsset?.description || input.styleDescription || input.styleName || "Cinematic";
        const styleNegs = styleAsset?.negatives || input.styleNegatives || "";

        if (hasStyle) {
            let styleBlock = "";
            if (hasStyleImage) {
                styleBlock += `STYLE: High fidelity Image ${styleIdx} STYLE:\n\n`;
            } else {
                styleBlock += `STYLE: \n\n`;
            }
            styleBlock += `[${styleDesc}]`;
            if (styleNegs) styleBlock += `\n[${styleNegs}]`;

            blocks.push(styleBlock);
        }

        // --- 3. Output Subject Block (Summary) ---
        // "SUBJECT IMAGES:[SUBJECT STUDIO ASSET REF IMAGES (1-)N][CLIP REFERENCE IMAGES (1-)N]"
        const subjectIndices: number[] = [];
        if (manifest.slots.location > 0) subjectIndices.push(manifest.slots.location);
        manifest.slots.characters.forEach(idx => { if (idx > 0) subjectIndices.push(idx); });
        manifest.slots.references.forEach(idx => { if (idx > 0) subjectIndices.push(idx); });

        // Flatten Descriptions for "Selected Studio Asset Description"
        const subjectDescs: string[] = [];
        if (locationAsset) subjectDescs.push(`Location: ${locationAsset.name}`);
        characterAssets.forEach(c => subjectDescs.push(`Character: ${c.name}`));

        // Collect Negatives
        const subjectNegs: string[] = [];
        if (locationAsset?.negatives) subjectNegs.push(locationAsset.negatives);
        characterAssets.forEach(c => { if (c.negatives) subjectNegs.push(c.negatives); });

        let subjectBlock = `OUTPUT SUBJECT:\n`;
        if (subjectIndices.length > 0) {
            const indicesStr = subjectIndices.map(i => `IMAGE ${i}`).join(', ');
            subjectBlock += `SUBJECT IMAGES: [${indicesStr}]\n`;
        }
        if (subjectDescs.length > 0) {
            subjectBlock += `[${subjectDescs.join('. ')}]\n`;
        }
        if (subjectNegs.length > 0) {
            subjectBlock += `[${subjectNegs.join('. ')}]\n`;
        }
        blocks.push(subjectBlock);

        // --- 4. Instruction Block ---
        if (hasStyle) {
            let instr = `[INSTRUCTION: Preserve the identity and purpose of the OUTPUT SUBJECT. `;
            if (hasStyleImage) {
                // Dynamic Strength
                const strength = Math.round((input.styleStrength || 5) * 10) + 100;
                instr += `Apply the Image ${styleIdx} STYLE: Facial style: ${strength}%, Artistic Interpretation; Material Properties & Textures; Shading, response to scene lighting; Fidelity & Quality: to the OUTPUT SUBJECT.]`;
            } else {
                instr += `Apply the defined STYLE properties to the OUTPUT SUBJECT.]`;
            }

            // Conditional "If Style Asset" Logic from snippet
            // "{if STYLE ASSET: [SYSTEM: PRIORITY RULE... OUTPUT WITH STYLE REFERENCE...]}"
            // This seems redundant with Block 1, but the snippet has it here too? 
            // The snippet effectively repeats the "Priority Rule" inside an "If Style Asset" block.
            // My implementation of Block 1 covers the "Priority Rule". 
            // The snippet's "OUTPUT WITH STYLE REFERENCE" block seems to be the detailed definition.

            if (hasStyleImage) {
                instr += `\n\n[SYSTEM: PRIORITY RULE:\n\nOUTPUT WITH STYLE REFERENCE:\n[Defined by STYLE of IMAGE ${styleIdx}: Facial style: ${Math.round((input.styleStrength || 5) * 10) + 100}%, Artistic Interpretation; Material Properties & Textures; Response to scene lighting; Fidelity & Quality]\n[${styleDesc}]\n]`;
            }

            blocks.push(instr);
        }

        // --- 5. Setup / Reference Block ---
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

        // --- 6. Action Block ---
        const actionText = input.clip.action || "";
        const dialogText = input.clip.dialog ? ` Character says: "${input.clip.dialog}"` : "";
        const clipNegs = input.subjectNegatives || "";

        blocks.push(`ACTION: [${actionText}]. [${dialogText}]\nshot.`);
        if (clipNegs) {
            blocks.push(`NO: [${clipNegs}].`);
        }

        // --- 7. Footer ---
        if (hasStyle) {
            blocks.push(`[OUTPUT: Render ACTION with strict adherence to STYLE REFERENCE.]`);
        }

        return blocks.join('\n\n');
    }
}
