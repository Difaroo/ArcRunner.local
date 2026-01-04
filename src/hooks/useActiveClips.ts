import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { resolveClipImages } from '@/lib/shared-resolvers';

export function useActiveClips() {
    const {
        clips,
        currentSeriesId,
        currentEpisode,
        allEpisodes,
        libraryItems,
        deletedClipIds
    } = useStore();

    // 1. Resolve Episode ID
    const seriesEpisodes = useMemo(() =>
        allEpisodes.filter(e => e.series === currentSeriesId)
            .sort((a, b) => {
                const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
                return numA - numB;
            }),
        [allEpisodes, currentSeriesId]
    );
    const currentEpObj = seriesEpisodes[currentEpisode - 1];
    const currentEpKey = currentEpObj ? currentEpObj.id : currentEpisode.toString();

    // 2. Library Map
    const allSeriesAssets = useMemo(() =>
        libraryItems.filter(i => i.series === currentSeriesId),
        [libraryItems, currentSeriesId]
    );

    const seriesLibraryMap = useMemo(() => {
        const map: Record<string, string> = {};
        allSeriesAssets.forEach(item => {
            if (item.name) map[item.name.toLowerCase()] = item.refImageUrl || '';
        });
        return map;
    }, [allSeriesAssets]);

    const findLibUrl = (name: string) => seriesLibraryMap[name.toLowerCase()];

    // 3. Resolve Clips
    const activeClips = useMemo(() => {
        const seriesClips = clips.filter(c => c.series === currentSeriesId);
        const episodeClips = seriesClips.filter(c => c.episode === currentEpKey);

        return episodeClips
            .filter(c => !deletedClipIds.has(c.id))
            .map(clip => {
                const { characterImageUrls, locationImageUrls } = resolveClipImages(clip, findLibUrl, 'single');
                return {
                    ...clip,
                    characterImageUrls,
                    locationImageUrls
                };
            })
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    }, [clips, currentSeriesId, currentEpKey, deletedClipIds, seriesLibraryMap]);

    const uniqueValues = useMemo(() => ({
        characters: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_CHARACTER').map(i => i.name))).sort(),
        locations: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_LOCATION').map(i => i.name))).sort(),
        styles: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_STYLE').map(i => i.name))).sort(),
        cameras: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_CAMERA').map(i => i.name))).sort(),
    }), [allSeriesAssets]);

    const sortedEpKeys = seriesEpisodes.map(e => e.id);

    return {
        activeClips,
        currentEpKey,
        sortedEpKeys,
        allSeriesAssets,
        uniqueValues
    };
}
