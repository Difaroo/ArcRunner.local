import { Clip, Media } from "@/types";

export type SlotType = 'style' | 'character' | 'location' | 'reference' | 'start-frame' | 'end-frame';

export interface InputSlot {
    id: string; // Unique ID for React keys
    type: SlotType;
    url: string;
    label: string;
    isAutoPopulated: boolean; // True if from Library/Text, False if Explicit Ref
    sortOrder: number; // 0-based index in the final manifest
    originalRefId?: string; // If explicit, the MediaReference ID
}

export interface Manifest {
    selectedUrls: string[];
    slots: InputSlot[];
    counts: {
        style: number;
        character: number;
        location: number;
        reference: number;
        total: number;
    }
}

interface LibraryContext {
    styleImage?: string;
    characterImages?: string[]; // Array of resolved URLs
    characterAssets?: any[]; // Metadata if needed
    locationImages?: string[];
}

/**
 * The Structural Manifest Resolver
 * 
 * Determines the "Intelligent Order" of images for a given Clip and Model.
 * This function is the Source of Truth for both the Backend (Payload) and Frontend (BEM UI).
 * 
 * Priority Rule: Style -> Location -> Character -> Explicit Refs
 */
export function resolveManifest(
    clip: Clip | null,
    model: string,
    library: LibraryContext,
    explicitRefs: Media[] = []
): Manifest {
    if (!clip) return { selectedUrls: [], slots: [], counts: { style: 0, character: 0, location: 0, reference: 0, total: 0 } };

    const slots: InputSlot[] = [];
    const modelId = (model || '').toLowerCase();

    // Model Constraints
    const isNano = modelId.includes('nano') || modelId.includes('flux');
    const isKling = modelId.includes('kling');
    const isS2E = modelId === 'veo-s2e';

    let maxImages = 3; // Standard Veo
    if (isNano) maxImages = 8;
    if (isKling) maxImages = 1;
    if (isS2E) maxImages = 2;

    const usedUrls = new Set<string>();

    // Helper to add slot
    const addSlot = (type: SlotType, url: string, label: string, isAuto: boolean, refId?: string) => {
        if (!url || url.length < 5 || usedUrls.has(url)) return;
        if (slots.length >= maxImages) return;

        slots.push({
            id: `${type}-${slots.length}`,
            type,
            url,
            label,
            isAutoPopulated: isAuto,
            sortOrder: slots.length,
            originalRefId: refId
        });
        usedUrls.add(url);
    };

    // --- KLING: Special Case (Refs Only) ---
    if (isKling) {
        // Kling only uses the Latest Explicit Reference
        const validRefs = explicitRefs.filter(r => r.url && r.url.length > 5);
        // Sort by refImageSort DESC (User preference)
        validRefs.sort((a, b) => (b.refImageSort || 0) - (a.refImageSort || 0));

        if (validRefs.length > 0) {
            addSlot('reference', validRefs[0].url, 'Reference Image', false, validRefs[0].id);
        }
    }
    // --- VEO S2E: Special Case (Start/End) ---
    else if (isS2E) {
        const validRefs = explicitRefs.filter(r => r.url && r.url.length > 5);
        // Sort by refImageSort DESC
        validRefs.sort((a, b) => (b.refImageSort || 0) - (a.refImageSort || 0));

        if (validRefs.length >= 2) {
            // [1] = Start Frame (First in Manifest)
            addSlot('start-frame', validRefs[1].url, 'Start Frame', false, validRefs[1].id);
            // [0] = End Frame (Second in Manifest)
            addSlot('end-frame', validRefs[0].url, 'End Frame', false, validRefs[0].id);
        } else if (validRefs.length === 1) {
            // Only 1 ref -> Start Frame
            addSlot('start-frame', validRefs[0].url, 'Start Frame', false, validRefs[0].id);
        }
    }
    // --- STANDARD HIERARCHY (Veo, Flux, Nano) ---
    else {
        // Priority 1: Style
        if (library.styleImage) {
            addSlot('style', library.styleImage, 'Style Reference', true);
        }

        // Priority 2: Location
        if (library.locationImages && library.locationImages.length > 0) {
            addSlot('location', library.locationImages[0], 'Location', true);
        }

        // Priority 3: Character
        if (library.characterImages) {
            library.characterImages.forEach((url, index) => {
                addSlot('character', url, `Character ${index + 1}`, true);
            });
        }

        // Priority 4: Explicit Refs
        const validRefs = explicitRefs.filter(r => r.url && r.url.length > 5);
        validRefs.sort((a, b) => (b.refImageSort || 0) - (a.refImageSort || 0));

        validRefs.forEach(ref => {
            addSlot('reference', ref.url, 'Reference', false, ref.id);
        });
    }

    return {
        selectedUrls: slots.map(s => s.url),
        slots,
        counts: {
            style: slots.filter(s => s.type === 'style').length,
            character: slots.filter(s => s.type === 'character').length,
            location: slots.filter(s => s.type === 'location').length,
            reference: slots.filter(s => s.type === 'reference' || s.type === 'start-frame' || s.type === 'end-frame').length,
            total: slots.length
        }
    };
}
