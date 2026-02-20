import { parseStringList } from './utils/string-helpers';
import { Media } from '@/types';

/**
 * Pure functions for resolving Clip properties.
 * Intended to be shared between Server (API) and Client (React).
 * NO server-only imports allowed (e.g. no 'fs', no 'db').
 * 
 * REFACTORED v0.33: Removed all legacy CSV parsing (refImageUrls/explicitRefUrls).
 * Source of truth is now exclusively the Media table (mediaReferences relation).
 */

export interface ClipReferenceSource {
    character?: string | null;
    location?: string | null;
    mediaReferences?: Array<{ url: string; refImageSort?: number;[key: string]: any }>; // Loose type for Prisma compat
}

export interface ResolverResult {
    fullRefs: string;           // Comma-separated string of ALL URLs (Library + Explicit)
    explicitRefs: string;       // Comma-separated string of JUST explicit/media ref URLs
    characterImageUrls: string[];
    locationImageUrls: string[];
}

/**
 * Resolves all reference images for a clip by combining:
 * 1. Explicit URLs from Media table (mediaReferences)
 * 2. Character Library Images (looked up by name)
 * 3. Location Library Images (looked up by name)
 * 
 * @param clip The clip object containing character/location names and mediaReferences.
 * @param findLibraryUrl A callback to look up a library image URL by exact name.
 * @param mode 'single' (default - take first image per asset) or 'all' (take all images per asset)
 */
export function resolveClipImages(
    clip: ClipReferenceSource,
    findLibraryUrl: (name: string) => string | undefined,
    mode: 'single' | 'all' = 'single'
): ResolverResult {
    // 1. Get explicit URLs directly from Media table
    const explicitRefUrls: string[] = (clip.mediaReferences || [])
        .sort((a, b) => (b.refImageSort ?? 0) - (a.refImageSort ?? 0))
        .map(m => m.url);

    const explicitStr = explicitRefUrls.join(',');

    const libraryRefUrls: string[] = [];
    const characterImageUrls: string[] = [];
    const locationImageUrls: string[] = [];

    // Helper to add unique URL
    const addUrl = (url: string, targetArray?: string[]) => {
        if (!url) return;
        const isExplicit = explicitRefUrls.includes(url);
        const isAlreadyLib = libraryRefUrls.includes(url);

        if (targetArray && !targetArray.includes(url)) {
            targetArray.push(url);
        }

        if (!isExplicit && !isAlreadyLib) {
            libraryRefUrls.push(url);
        }
    };

    // Helper for mode-based processing
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
    const allRefs = [...libraryRefUrls, ...explicitRefUrls].join(',');

    return {
        fullRefs: allRefs,
        explicitRefs: explicitStr,
        characterImageUrls,
        locationImageUrls
    };
}
