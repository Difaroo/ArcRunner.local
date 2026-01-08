import { GenerationContext } from '../PayloadBuilder';
import { ImageManifest } from './types';

export class PromptSelector {

    static select(context: GenerationContext): ImageManifest {
        const { input, characterImages, locationImages, explicitImages, styleImage } = context;
        console.log(`[PromptSelector DEBUG] Input Arrays: Loc=${locationImages?.length}, Chars=${characterImages?.length}, Explicit=${explicitImages?.length}`);

        let selectedImages: string[] = [];
        const maxTotal = 3;

        // 1-based index trackers
        let locImgIdx = 0;
        const charImgIndices: number[] = new Array(characterImages.length).fill(0);
        const refImgIndices: number[] = [];
        let styleImgIdx = 0;

        // --- Logic Branch: S2E vs Standard ---
        const isS2E = input.model === 'veo-s2e';

        if (isS2E) {
            // S2E STRICT: Image 1 = Start, Image 2 = End
            // Source: explicitImages only
            if (explicitImages.length >= 2) {
                selectedImages = [explicitImages[0], explicitImages[1]];
                // S2E usually doesn't map to Location/Character slots in the same way,
                // but for consistency we can leave slots empty or map them if needed.
                // For now, simple S2E manifests usually don't need slot mapping for ABCD schemas.
                // But we return a valid manifest.
            } else if (explicitImages.length === 1) {
                // Fallback to Reference Mode (handled by downstream/Schema?)
                // Or we just return what we have.
                selectedImages = [explicitImages[0]];
                refImgIndices.push(1);
            }
        } else {
            // --- Standard Hierarchy Logic ---
            const tempImages: string[] = [];
            const isStyleImageActive = !!styleImage;
            const capacity = isStyleImageActive ? maxTotal - 1 : maxTotal;

            // Helper: Add unique, valid URL
            const addImage = (url: string): number => {
                // Defensive: Valid URL check ( > 5 chars, not undefined string)
                if (url && url.length > 5 && url !== 'undefined' && url !== 'null' && !tempImages.includes(url)) {
                    tempImages.push(url);
                    return tempImages.length; // New 1-based index
                }
                return 0;
            };

            // 1. Location (Priority)
            if (locationImages && locationImages.length > 0) {
                locImgIdx = addImage(locationImages[0]);
            }

            // 2. Characters (Smart Linkage)
            // Strategy: Iterate granular images first. 
            // If granular image missing, check if Asset has a URL that matches an Explicit Image.

            let slotsLeft = capacity - tempImages.length;

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

            // 3. Explicit References (Fillers)
            // Now we add any explicit refs that weren't "claimed" by characters
            slotsLeft = capacity - tempImages.length;
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

            // 4. Style (Last Slot)
            if (isStyleImageActive && styleImage) {
                styleImgIdx = addImage(styleImage);
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
