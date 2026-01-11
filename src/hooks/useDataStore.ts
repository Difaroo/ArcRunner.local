import { create, StateCreator } from 'zustand';
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
    lastWriteTime: number; // Concurrency Control

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
    notifyWrite: () => void;
    refreshData: (silent?: boolean) => Promise<void>;

    // Media Player State
    playingClipId: string | null;
    playingVideoUrl: string | null;
    playlist: string[];
    currentPlayIndex: number;
    // Setters & Actions
    setCurrentEpisode: (episode: number) => void;
    navigateToEpisode: (seriesId: string, episodeId: string) => void;
    setPlayingVideoUrl: (url: string | null) => void;
    setPlayingClip: (id: string | null, url: string | null) => void;
    setPlaylist: (urls: string[]) => void;
    setCurrentPlayIndex: (index: number) => void;
}

const createStore: StateCreator<AppState> = (set, get) => ({
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
    lastWriteTime: 0,

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

    // Concurrency Control
    notifyWrite: () => set({ lastWriteTime: Date.now() }),

    refreshData: async (silent = false) => {
        const startTime = Date.now();
        if (!silent) set({ loading: true });

        try {
            const res = await fetch('/api/clips', { cache: 'no-store' });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // Batch updates with Concurrency Check
            set((state) => {
                // If a write occurred AFTER this fetch started, ignore the result to prevent overwriting
                if (state.lastWriteTime > startTime) {
                    console.log(`[DataStore] Skipping poll update. Write occurred at ${state.lastWriteTime} > Fetch Start ${startTime}`);

                    // We can still update non-volatile things if we want, but for safety, stick to existing state
                    return { loading: false };
                }

                // Smart Merge Logic: Preserve Task ID if Server returns empty but Local has it (Race Condition Fix)
                const currentClips = state.clips;
                const newClips = (data.clips || []).map((nc: Clip) => {
                    const existing = currentClips.find(c => c.id === nc.id);

                    if (existing && existing.taskId && !nc.taskId && existing.status === 'Generating' && nc.status === 'Generating') {
                        // Keep local Task ID
                        return { ...nc, taskId: existing.taskId, model: existing.model || nc.model };
                    }
                    return nc;
                });

                const updates: Partial<AppState> = {
                    clips: newClips,
                    loading: false
                };

                if (data.episodeTitles) updates.episodeTitles = data.episodeTitles;
                if (data.episodes) updates.allEpisodes = data.episodes || [];
                if (data.libraryItems) updates.libraryItems = data.libraryItems || [];

                if (data.series) {
                    updates.seriesList = data.series || [];

                    // Auto-select first series if invalid
                    const currentId = state.currentSeriesId;
                    const exists = (data.series || []).find((s: Series) => s.id === currentId);

                    if (!exists && data.series && data.series.length > 0) {
                        updates.currentSeriesId = data.series[0].id; // Default to first
                    }
                }

                return updates;
            });

        } catch (err: any) {
            console.error('Fetch error:', err);
            set({ error: err.message, loading: !silent ? false : get().loading });
        } finally {
            // Only turn off loading if we actually touched it
            if (!silent) set((state) => ({ loading: false }));
        }
    },

    // Media Player Implementation
    playingClipId: null,
    playingVideoUrl: null,
    playlist: [],
    currentPlayIndex: -1,
    setPlayingVideoUrl: (url) => set({ playingVideoUrl: url, playingClipId: null }),
    setPlayingClip: (id, url) => set({ playingClipId: id, playingVideoUrl: url }),
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
});

export const useDataStore = create<AppState>(createStore);
