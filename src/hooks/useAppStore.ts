import { LibraryItem } from '@/lib/library';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Clip, Series } from '@/app/api/clips/route';
import { usePolling } from '@/hooks/usePolling';

export function useAppStore() {
    const [clips, setClips] = useState<Clip[]>([]);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    const [currentSeriesId, setCurrentSeriesId] = useState<string>("1"); // Default ID? Maybe should be empty initially
    const [episodeTitles, setEpisodeTitles] = useState<Record<string, string>>({});
    const [allEpisodes, setAllEpisodes] = useState<{ series: string, id: string, title: string, model?: string }[]>([]);
    const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [deletedLibraryIds, setDeletedLibraryIds] = useState<Set<string>>(new Set());
    const [deletedClipIds, setDeletedClipIds] = useState<Set<string>>(new Set());

    const markLibraryItemDeleted = useCallback((id: string) => {
        setDeletedLibraryIds(prev => new Set(prev).add(id));
    }, []);

    const markClipDeleted = useCallback((id: string) => {
        setDeletedClipIds(prev => new Set(prev).add(id));
    }, []);

    const hasFetched = useRef(false);

    const refreshData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch('/api/clips', { cache: 'no-store' });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setClips(data.clips);
            if (data.episodeTitles) setEpisodeTitles(data.episodeTitles);
            if (data.episodes) setAllEpisodes(data.episodes);
            if (data.libraryItems) setLibraryItems(data.libraryItems);
            if (data.series) {
                setSeriesList(data.series);
                // Default to first series if current is invalid
                // Note: If currentSeriesId is "1" (initial) and data.series has IDs like "uuid-...", 
                // checking series.find may fail, so we auto-select the first one.
                // We typically passed "1" as initial state in Page, but here we can be smarter.
                // But we need access to the STATE 'currentSeriesId' inside this callback? Yes, it's in scope.

                // We only override if current is missing from list
                const exists = data.series.find((s: Series) => s.id === currentSeriesId);
                if (!exists && data.series.length > 0) {
                    // CAREFUL: Calling SetState inside Render/Effect loop. 
                    // This refreshData is called by useEffect.
                    setCurrentSeriesId(data.series[0].id);
                }
            }
        } catch (err: any) {
            console.error('Fetch error:', err);
            setError(err.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [currentSeriesId]);

    // Use Polling Hook
    usePolling({ clips, libraryItems, refreshData });

    // Initial Fetch
    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;
        refreshData();
    }, [refreshData]);

    return {
        clips, setClips,
        seriesList, setSeriesList,
        currentSeriesId, setCurrentSeriesId,
        episodeTitles, setEpisodeTitles,
        allEpisodes, setAllEpisodes,
        libraryItems, setLibraryItems,
        deletedLibraryIds, markLibraryItemDeleted,
        deletedClipIds, markClipDeleted,
        loading, setLoading,
        error, setError,
        refreshData
    };
}
