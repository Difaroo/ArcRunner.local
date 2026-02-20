import { GenerationContext } from '../PayloadBuilder';
import { ImageManifest } from './types';
import { resolveManifest } from '@/lib/structural-manifest';

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

        // Map context to LibraryContext
        const libraryContext = {
            styleImage: styleImage || undefined, // Convert null to undefined
            characterImages,
            locationImages,
            characterAssets: context.characterAssets
        };

        // Map explicit strings to pseudo-ClipMediaReference for the resolver
        // (The resolver expects objects with IDs, but for backend context we might only have URLs strings? 
        // Context.explicitImages is string[]. We need to wrap them.)
        // Actually, PromptSelector receives `explicitImages` as string[].
        // But `resolveManifest` expects `ClipMediaReference[]` to handle S2E sort logic properly if needed.
        // However, `explicitImages` in GenerateManager are ALREADY sorted by `refImageSort` in `resolveClipImages`.
        // So we can map them to dummy objects preserving order.

        const explicitRefs = (explicitImages || []).map((url, index) => ({
            id: `explicit-${index}`,
            url,
            type: 'IMAGE',
            category: 'REF',
            refImageSort: (explicitImages || []).length - index // Preserve order
        })) as any;

        // Call Shared Resolver
        const manifest = resolveManifest(
            { ...input } as any, // Cast input to Clip (it has model, etc)
            input.model || '',
            libraryContext,
            explicitRefs
        );

        // Map back to old ImageManifest format if needed, OR just return the new Manifest
        // The old 'ImageManifest' interface in 'types' might need update or we map to it.
        // Old Interface: { selectedUrls: string[], slots: { location: number, ... }, counts: ... }
        // New Manifest: { selectedUrls, slots: InputSlot[], counts }

        // We need to map `InputSlot[]` back to the `slots` indices format for legacy compatibility if `ImageManifest` is strict.
        // Let's check `ImageManifest` type. It's imported from `./types`.
        // If I change the return type, I might break `PromptConstructor`.
        // SAFE APPROACH: Map new `slots` to old `indices`.

        const slotIndices = {
            style: 0,
            location: 0,
            characters: [] as number[],
            references: [] as number[]
        };

        manifest.slots.forEach((s, i) => {
            const oneBasedIndex = i + 1; // 1-based index used by PromptSelector legacy
            if (s.type === 'style') slotIndices.style = oneBasedIndex;
            if (s.type === 'location') slotIndices.location = oneBasedIndex;
            if (s.type === 'character') slotIndices.characters.push(oneBasedIndex);
            if (s.type === 'reference' || s.type === 'start-frame' || s.type === 'end-frame') slotIndices.references.push(oneBasedIndex);
        });

        return {
            selectedUrls: manifest.selectedUrls,
            slots: slotIndices,
            counts: {
                total: manifest.counts.total,
                chars: manifest.counts.character,
                refs: manifest.counts.reference
            }
        };
    }
}
