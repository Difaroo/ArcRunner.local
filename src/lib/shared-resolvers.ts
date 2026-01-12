import { parseStringList, joinStringList } from './utils/string-helpers';
import { Media } from '@/types';

/**
 * Pure functions for resolving Clip properties.
 * Intended to be shared between Server (API) and Client (React).
 * NO server-only imports allowed (e.g. no 'fs', no 'db').
 */

export interface ClipReferenceSource {
    character?: string | null;
    location?: string | null;
    refImageUrls?: string | null; // Legacy CSV
    explicitRefUrls?: string | null; // Legacy CSV (Explicit)
    mediaReferences?: Media[]; // New Source of Truth
}

export interface ResolverResult {
    fullRefs: string;           // Comma-separated string of ALL URLs (Library + Explicit)
    explicitRefs: string;       // Comma-separated string of JUST Explicit URLs
    characterImageUrls: string[];
    locationImageUrls: string[];
}

/**
 * Resolves all reference images for a clip by combining:
 * 1. Explicit URLs (manually entered/pasted or from Media Table)
 * 2. Character Library Images (looked up by name)
 * 3. Location Library Images (looked up by name)
 * 
 * @param clip The clip object containing character/location names and explicit URLs.
 * @param findLibraryUrl A callback to look up a library image URL by exact name.
 * @param mode 'single' (default - take first image per asset) or 'all' (take all images per asset)
 */
export function resolveClipImages(
    clip: ClipReferenceSource,
    findLibraryUrl: (name: string) => string | undefined,
    mode: 'single' | 'all' = 'single'
): ResolverResult {
    // 1. Parse Explicit URLs
    // Priority: Media Table > Explicit String > Legacy Ref String
    let explicitRefUrls: string[] = [];

    if (clip.mediaReferences && clip.mediaReferences.length > 0) {
        explicitRefUrls = clip.mediaReferences.map(m => m.url);
    } else {
        const explicitStr = clip.explicitRefUrls !== undefined && clip.explicitRefUrls !== null
            ? clip.explicitRefUrls
            : (clip.refImageUrls || '');
        explicitRefUrls = parseStringList(explicitStr);
    }

    // For return value, we reconstruct the string (backward compat)
    const explicitStr = joinStringList(explicitRefUrls);

    const libraryRefUrls: string[] = [];
    const characterImageUrls: string[] = [];
    const locationImageUrls: string[] = [];

    // Helper to ensure uniqueness
    const addUrl = (url: string, targetArray?: string[]) => {
        if (!url) return;

        // Check if this URL is already considered "Explicit"
        const isExplicit = explicitRefUrls.includes(url);
        const isAlreadyLib = libraryRefUrls.includes(url);

        if (targetArray && !targetArray.includes(url)) {
            targetArray.push(url);
        }

        // We do NOT remove from explicitRefUrls even if found in library, 
        // because explicit list defines user intent.

        if (!isExplicit && !isAlreadyLib) {
            libraryRefUrls.push(url);
        }
    };

    // Helper to extract correct URLs based on mode
    const processLibraryRef = (str: string, targetArray: string[]) => {
        const rawUrls = parseStringList(str);
        if (rawUrls.length === 0) return;

        if (mode === 'single') {
            addUrl(rawUrls[0], targetArray);
        } else {
            rawUrls.forEach(u => addUrl(u, targetArray));
        }
    };

    // 2. Character Lookup
    if (clip.character) {
        const names = parseStringList(clip.character);
        names.forEach(name => {
            const cleanName = name.trim();
            if (cleanName) {
                const urlOrUrls = findLibraryUrl(cleanName);
                if (urlOrUrls) {
                    processLibraryRef(urlOrUrls, characterImageUrls);
                }
            }
        });
    }

    // 3. Location Lookup
    if (clip.location) {
        const cleanName = clip.location.trim();
        if (cleanName) {
            const urlOrUrls = findLibraryUrl(cleanName);
            if (urlOrUrls) {
                processLibraryRef(urlOrUrls, locationImageUrls);
            }
        }
    }

    // 4. Combine
    const allRefs = joinStringList([...libraryRefUrls, ...explicitRefUrls]);

    return {
        fullRefs: allRefs,
        explicitRefs: explicitStr,
        characterImageUrls,
        locationImageUrls
    };
}
