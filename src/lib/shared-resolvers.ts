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
 * @param findLibraryUrl A callback to look up a library image URL by exact name.
 * @param mode 'single' (default - take first image per asset) or 'all' (take all images per asset)
 */
export function resolveClipImages(
    clip: ClipReferenceSource,
    findLibraryUrl: (name: string) => string | undefined,
    mode: 'single' | 'all' = 'single'
): ResolverResult {
    // 1. Parse Explicit URLs
    // We strictly prefer 'explicitRefUrls' (client state).
    // If fallback to 'refImageUrls' (DB state) is required, we must be careful.
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
        const rawUrls = str.split(',').map(u => u.trim()).filter(Boolean);
        if (rawUrls.length === 0) return;

        if (mode === 'single') {
            addUrl(rawUrls[0], targetArray);
        } else {
            rawUrls.forEach(u => addUrl(u, targetArray));
        }
    };

    // 2. Character Lookup
    if (clip.character) {
        const names = clip.character.split(',');
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
    const allRefs = [...libraryRefUrls, ...explicitRefUrls].join(',');

    return {
        fullRefs: allRefs,
        explicitRefs: explicitStr,
        characterImageUrls,
        locationImageUrls
    };
}
