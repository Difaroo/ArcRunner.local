/**
 * Pure functions for resolving Clip properties.
 * Intended to be shared between Server (API) and Client (React).
 * NO server-only imports allowed (e.g. no 'fs', no 'db').
 */

export interface ClipReferenceSource {
    character?: string | null;
    location?: string | null;
    refImageUrls?: string | null; // The combined string in some contexts, or explicit in others.
    // In our DB, 'refImageUrls' column traditionally held the EXPLICIT ones.
    // But the API RE-WRITES it to be ALL.
    // So we usually look at 'explicitRefUrls' if available, or fall back.
    explicitRefUrls?: string | null;
}

export interface ResolverResult {
    fullRefs: string;           // Comma-separated string of ALL URLs (Library + Explicit)
    explicitRefs: string;       // Comma-separated string of JUST Explicit URLs
    characterImageUrls: string[];
    locationImageUrls: string[];
}

/**
 * Resolves all reference images for a clip by combining:
 * 1. Explicit URLs (manually entered/pasted)
 * 2. Character Library Images (looked up by name)
 * 3. Location Library Images (looked up by name)
 * 
 * @param clip The clip object containing character/location names and explicit URLs.
 * @param findLibraryUrl A callback to look up a library image URL by exact name (case-insensitive usually handled by caller or here).
 */
export function resolveClipImages(
    clip: ClipReferenceSource,
    findLibraryUrl: (name: string) => string | undefined
): ResolverResult {
    // 1. Parse Explicit URLs
    // We prefer 'explicitRefUrls' if it exists (Client editing state), 
    // otherwise fallback to 'refImageUrls' (DB state, assuming it might only contain explicit ones on raw read, 
    // OR we act defensively and assume we want to preserve whatever was considered "Explicit" manual entry).

    // NOTE: The convention is that `explicitRefUrls` holds the manually entered ones.
    const explicitStr = clip.explicitRefUrls !== undefined && clip.explicitRefUrls !== null
        ? clip.explicitRefUrls
        : (clip.refImageUrls || '');

    const explicitRefUrls = explicitStr.split(',').map(u => u.trim()).filter(Boolean);

    const libraryRefUrls: string[] = [];
    const characterImageUrls: string[] = [];
    const locationImageUrls: string[] = [];

    // Helper to ensure uniqueness
    const addUrl = (url: string, targetArray?: string[]) => {
        if (!url) return;
        // Don't add if already in explicit (explicit overrides library? Or just merge?)
        // Usually we want ALL valid refs. 
        // But if I manually added a URL that is ALSO in library, do I want it twice? No.
        const isExplicit = explicitRefUrls.includes(url);
        const isAlreadyLib = libraryRefUrls.includes(url);

        if (targetArray && !targetArray.includes(url)) {
            targetArray.push(url);
        }

        if (!isExplicit && !isAlreadyLib) {
            libraryRefUrls.push(url);
        }
    };

    // 2. Character Lookup
    if (clip.character) {
        // Split by comma, trim
        const names = clip.character.split(',');
        names.forEach(name => {
            const cleanName = name.trim();
            if (cleanName) {
                const url = findLibraryUrl(cleanName);
                if (url) addUrl(url, characterImageUrls);
            }
        });
    }

    // 3. Location Lookup
    if (clip.location) {
        // usually single location, but treat safe
        const cleanName = clip.location.trim();
        if (cleanName) {
            const url = findLibraryUrl(cleanName);
            if (url) addUrl(url, locationImageUrls);
        }
    }

    // 4. Combine
    const allRefs = [...libraryRefUrls, ...explicitRefUrls].join(',');

    return {
        fullRefs: allRefs,
        explicitRefs: explicitStr,
        characterImageUrls,
        locationImageUrls
    };
}
