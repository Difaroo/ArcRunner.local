import { create } from 'zustand';
import { Clip, Series, Episode, LibraryItem } from '@/types';

interface AppState {
    // State
    clips: Clip[];
    seriesList: Series[];
    currentSeriesId: string;
    currentEpisode: number;
    episodeTitles: Record<string, string>;
    allEpisodes: Episode[];
    libraryItems: LibraryItem[];
    loading: boolean;
    error: string;
    deletedLibraryIds: Set<string>;
    deletedClipIds: Set<string>;

    // Simple Setters
    setClips: (clips: Clip[] | ((prev: Clip[]) => Clip[])) => void;
    setSeriesList: (seriesList: Series[] | ((prev: Series[]) => Series[])) => void;
    setCurrentSeriesId: (id: string) => void;
    setEpisodeTitles: (titles: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
    setAllEpisodes: (episodes: Episode[] | ((prev: Episode[]) => Episode[])) => void;
    setLibraryItems: (items: LibraryItem[] | ((prev: LibraryItem[]) => LibraryItem[])) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;

    // Logic Actions
    markLibraryItemDeleted: (id: string) => void;
    markClipDeleted: (id: string) => void;
    refreshData: (silent?: boolean) => Promise<void>;

    // Media Player State
    // Media Player State
    playingVideoUrl: string | null;
    playlist: string[];
    currentPlayIndex: number;
    // Setters & Actions
    setCurrentEpisode: (episode: number) => void;
    navigateToEpisode: (seriesId: string, episodeId: string) => void;
    setPlayingVideoUrl: (url: string | null) => void;
    setPlaylist: (urls: string[]) => void;
    setCurrentPlayIndex: (index: number) => void;
}

export const useStore = create<AppState>((set, get) => ({
    // Initial State
    clips: [],
    seriesList: [],
    currentSeriesId: "1",
    currentEpisode: 1,
    episodeTitles: {},
    allEpisodes: [],
    libraryItems: [],
    loading: true,
    error: '',
    deletedLibraryIds: new Set(),
    deletedClipIds: new Set(),

    // Generic Setter Helpers
    setClips: (input) => set((state) => ({ clips: typeof input === 'function' ? (input as any)(state.clips) : input })),
    setSeriesList: (input) => set((state) => ({ seriesList: typeof input === 'function' ? (input as any)(state.seriesList) : input })),
    setCurrentSeriesId: (currentSeriesId) => set({ currentSeriesId }),
    setEpisodeTitles: (input) => set((state) => ({ episodeTitles: typeof input === 'function' ? (input as any)(state.episodeTitles) : input })),
    setAllEpisodes: (input) => set((state) => ({ allEpisodes: typeof input === 'function' ? (input as any)(state.allEpisodes) : input })),
    setLibraryItems: (input) => set((state) => ({ libraryItems: typeof input === 'function' ? (input as any)(state.libraryItems) : input })),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),

    // Logic Actions
    markLibraryItemDeleted: (id) => set((state) => ({
        deletedLibraryIds: new Set(state.deletedLibraryIds).add(id)
    })),

    markClipDeleted: (id) => set((state) => ({
        deletedClipIds: new Set(state.deletedClipIds).add(id)
    })),

    refreshData: async (silent = false) => {
        if (!silent) set({ loading: true });

        try {
            const res = await fetch('/api/clips', { cache: 'no-store' });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // Batch updates? Zustand handles this well.
            set((state) => {
                const updates: Partial<AppState> = {
                    clips: data.clips,
                    loading: false // If success, stop loading
                };

                if (data.episodeTitles) updates.episodeTitles = data.episodeTitles;
                if (data.episodes) updates.allEpisodes = data.episodes;
                if (data.libraryItems) updates.libraryItems = data.libraryItems;

                if (data.series) {
                    updates.seriesList = data.series;

                    // Logic to update currentSeriesId if invalid
                    // We check against the *current* state (available in 'state' arg or via get())
                    // Here 'state' is the snapshot before this set call.
                    const currentId = state.currentSeriesId;
                    const exists = data.series.find((s: Series) => s.id === currentId);

                    if (!exists && data.series.length > 0) {
                        updates.currentSeriesId = data.series[0].id;
                    }
                }

                return updates;
            });

        } catch (err: any) {
            console.error('Fetch error:', err);
            set({ error: err.message, loading: !silent ? false : get().loading });
        } finally {
            if (!silent) set({ loading: false });
        }
    },

    // Media Player Implementation
    playingVideoUrl: null,
    playlist: [],
    currentPlayIndex: -1,
    setPlayingVideoUrl: (url) => set({ playingVideoUrl: url }),
    setCurrentEpisode: (currentEpisode) => set({ currentEpisode }),
    setPlaylist: (playlist) => set({ playlist }),
    setCurrentPlayIndex: (currentPlayIndex) => set({ currentPlayIndex }),

    navigateToEpisode: (seriesId, episodeId) => {
        const { allEpisodes } = get();
        // Calculate index
        const sorted = allEpisodes.filter(e => e.series === seriesId)
            .sort((a, b) => {
                const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
                return numA - numB;
            });

        const idx = sorted.findIndex(e => e.id === episodeId);
        const targetEp = idx !== -1 ? idx + 1 : 1;

        set({ currentSeriesId: seriesId, currentEpisode: targetEp });
    }
}));
