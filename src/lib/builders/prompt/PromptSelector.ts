import { GenerationContext } from '../PayloadBuilder';
import { ImageManifest } from './types';

/**
 * IMAGE MANIFEST PRIORITY SPECIFICATION
 * 
 * NOTE: Ref images are in REVERSE order (latest added = first in array)
 *       because most processes use the most recent ref image.
 * 
 * Model-specific priorities:
 * 
 * VEO (Standard): Max 3 images
 *   Priority: Style → Location → Characters (up to 3) → Ref Images (up to 3)
 * 
 * VEO S2E (Start-to-End): Max 2 images
 *   Priority: Ref Images only - [0] = Start Frame, [1] = End Frame
 * 
 * KLING: Max 1 image
 *   Priority: Latest Ref Image (first in explicitImages array)
 * 
 * FLUX / NANO: Max 8 images
 *   Priority: Style → Location → Characters (up to 8) → Ref Images (up to 8)
 */

export class PromptSelector {

    static select(context: GenerationContext): ImageManifest {
        const { input, characterImages, locationImages, explicitImages, styleImage } = context;
        console.log(`[PromptSelector DEBUG] Input Arrays: Loc=${locationImages?.length}, Chars=${characterImages?.length}, Explicit=${explicitImages?.length}`);

        // Model-specific capacity
        const model = (input.model || '').toLowerCase();
        const isNanoModel = model.includes('nano') || model.includes('banana') || model.includes('flux');
        const isKlingModel = model.includes('kling');
        const isS2E = input.model === 'veo-s2e';

        // Determine max images based on model
        let maxTotal = 3; // Default for Veo
        if (isNanoModel) maxTotal = 8;
        if (isKlingModel) maxTotal = 1;
        if (isS2E) maxTotal = 2;

        // 1-based index trackers
        let locImgIdx = 0;
        const charImgIndices: number[] = new Array(characterImages.length).fill(0);
        const refImgIndices: number[] = [];
        let styleImgIdx = 0;

        let selectedImages: string[] = [];

        // --- KLING: Latest Filtered Ref Image Only ---
        if (isKlingModel) {
            // STRICT RULE: Kling requires Manual Reference Image. No Fallbacks.
            // Robustness: Filter out failed uploads ("") or short junk
            const validExplicit = explicitImages?.filter(u => u && u.length > 5) || [];

            if (validExplicit.length > 0) {
                // validExplicit[0] is latest (reverse sorted)
                selectedImages = [validExplicit[0]];
                refImgIndices.push(1);
            }
            // If no explicit ref, selectedImages remains [], causing Builder to throw Validation Error.
        }
        // --- S2E: Start + End Frames ---
        else if (isS2E) {
            // S2E STRICT: Refs are LIFO (newest first), so [1]=START, [0]=END
            // Reverse order for correct playback: [1, 0] → [START, END]
            if (explicitImages && explicitImages.length >= 2) {
                selectedImages = [explicitImages[1], explicitImages[0]];
            } else if (explicitImages && explicitImages.length === 1) {
                selectedImages = [explicitImages[0]];
                refImgIndices.push(1);
            }
        } else {
            // --- Standard Hierarchy Logic (Veo, Flux, Nano) ---
            // Priority Order: Style → Location → Characters → Refs
            const tempImages: string[] = [];

            // Helper: Add unique, valid URL
            const addImage = (url: string): number => {
                // Defensive: Valid URL check ( > 5 chars, not undefined string)
                if (url && url.length > 5 && url !== 'undefined' && url !== 'null' && !tempImages.includes(url)) {
                    tempImages.push(url);
                    return tempImages.length; // New 1-based index
                }
                return 0;
            };

            // 1. Style (First Priority - Reference for artistic direction)
            if (styleImage) {
                styleImgIdx = addImage(styleImage);
            }

            let slotsLeft = maxTotal - tempImages.length;

            // 2. Location
            if (locationImages && locationImages.length > 0 && slotsLeft > 0) {
                locImgIdx = addImage(locationImages[0]);
                if (locImgIdx > 0) slotsLeft--;
            }

            // 3. Characters (Smart Linkage)
            // Strategy: Iterate granular images first. 
            // If granular image missing, check if Asset has a URL that matches an Explicit Image.

            // We iterate based on Asssets (Rich Data) if available, or just images?
            // The context provides 'characterImages' (resolved array) AND 'characterAssets' (metadata).
            // We want to map indices for each Asset.

            const numChars = Math.max(
                characterImages ? characterImages.length : 0,
                context.characterAssets ? context.characterAssets.length : 0
            );

            for (let i = 0; i < numChars; i++) {
                if (slotsLeft > 0) {
                    let urlToUse = characterImages && characterImages[i] ? characterImages[i] : null;

                    // Smart Linkage: If no direct URL, check Asset for a URL that might be in Explicit list
                    if (!urlToUse && context.characterAssets && context.characterAssets[i]?.refImageUrl) {
                        const assetUrl = context.characterAssets[i].refImageUrl;
                        // Is this URL in explicit images?
                        if (assetUrl && explicitImages && explicitImages.some(e => e.includes(assetUrl!) || assetUrl!.includes(e))) {
                            // Loose match or exact match? 
                            // Since URLs might get signed or modified, strict match is safest if possible, 
                            // but we can try exact string match first.
                            // Actually, let's just try to add the Asset URL. 
                            // If it was already added (via explicit loop later? No, we are before explicit loop).
                            // If we add it here, 'tempImages' will contain it. 
                            // Later, the Explicit Loop will see it's already in tempImages and return the SAME index.
                            urlToUse = assetUrl;
                        }
                    }

                    if (urlToUse) {
                        const idx = addImage(urlToUse);
                        charImgIndices[i] = idx; // Assign the slot
                        if (idx > 0) slotsLeft--;
                    }
                }
            }

            // 4. Explicit References (Fillers)
            // Now we add any explicit refs that weren't "claimed" by characters
            slotsLeft = maxTotal - tempImages.length;
            if (explicitImages) {
                for (let i = 0; i < explicitImages.length; i++) {
                    if (slotsLeft > 0) {
                        const idx = addImage(explicitImages[i]);
                        if (idx > 0) {
                            // Only add to 'references' list if it wasn't just claimed by a character!
                            // How do we know? We check if this index is in charImgIndices.
                            const isClaimedByChar = charImgIndices.includes(idx);

                            if (!isClaimedByChar) {
                                refImgIndices.push(idx);
                                slotsLeft--;
                            }
                        }
                    }
                }
            }

            selectedImages = tempImages;
        }

        return {
            selectedUrls: selectedImages,
            slots: {
                location: locImgIdx,
                characters: charImgIndices,
                style: styleImgIdx,
                references: refImgIndices
            },
            counts: {
                total: selectedImages.length,
                chars: charImgIndices.filter(i => i > 0).length,
                refs: refImgIndices.length
            }
        };
    }
}
