import { create, StateCreator } from 'zustand';
import { Clip, Series, Episode, LibraryItem } from '@/types';
import { clipsApi } from '@/services/api';

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

    // Core Data Mutations
    updateClip: (id: string, updates: Partial<Clip>) => Promise<void>;
    updateSeries: (id: string, updates: Partial<Series>) => Promise<void>;
    addClip: () => Promise<void>;
    duplicateClip: (id: string) => Promise<void>;
    deleteClip: (id: string) => Promise<void>;

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

    // --- Core Data Mutations ---
    updateSeries: async (id: string, updates: Partial<Series>) => {
        const { setSeriesList, notifyWrite, refreshData } = get();
        // 1. Optimistic Update
        setSeriesList(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
        notifyWrite();

        try {
            // 2. API Call
            const payload = { seriesId: id, ...updates };
            const res = await fetch('/api/update_series', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Update failed");
        } catch (e) {
            console.error("Series update failed", e);
            refreshData(); // Revert/Refresh on error
            throw e;
        }
    },

    updateClip: async (clipId: string, updates: Partial<Clip>) => {
        const { clips, notifyWrite } = get();
        try {
            const data = await clipsApi.update(parseInt(clipId), updates);
            if (!data.success) throw new Error(data.error || 'Failed to parse save');

            notifyWrite();

            set((state) => {
                const newClips = state.clips.map(c => c.id === clipId ? {
                    ...c,
                    ...(data.clip || {}),
                    ...updates, // optimistically apply updates
                    mediaReferences: data.clip?.mediaReferences || c.mediaReferences || [],
                    modelInputSlots: data.clip?.modelInputSlots || c.modelInputSlots || []
                } : c);
                return { clips: newClips };
            });
        } catch (err) {
            console.error('Save error:', err);
            throw err;
        }
    },

    addClip: async () => {
        const { clips, currentSeriesId, currentEpisode, allEpisodes, notifyWrite } = get();
        if (!currentSeriesId) throw new Error("Please select a series first.");

        const currentEpKey = allEpisodes.find(e => e.series === currentSeriesId && e.id === currentEpisode.toString())?.id || '1';
        const activeClips = clips.filter(c => c.episode === currentEpKey && c.series === currentSeriesId);

        let newSortOrder = activeClips.length > 0 ? (activeClips[activeClips.length - 1].sortOrder || 0) + 10 : 10;
        const tempId = `temp-${Date.now()}`;
        const newClip: Clip = {
            id: tempId, scene: "0", sortOrder: newSortOrder, status: 'Ready',
            resultUrl: '', taskId: '', episode: currentEpKey, series: currentSeriesId,
            title: 'New Clip', character: '', location: '', action: '', camera: '', style: '', dialog: ''
        };

        set((state) => ({ clips: [newClip, ...state.clips] }));

        try {
            const data = await clipsApi.create({ clip: newClip });
            if (!data.success) throw new Error(data.error || 'Creation failed');
            notifyWrite();

            set((state) => ({
                clips: state.clips.map(c => c.id === tempId ? { ...c, id: data.clip.id, episode: data.clip.episode } : c)
            }));
        } catch (err) {
            console.error("Add Clip Failed", err);
            set((state) => ({ clips: state.clips.filter(c => c.id !== tempId) }));
            throw err;
        }
    },

    duplicateClip: async (id: string) => {
        const { clips, currentSeriesId, notifyWrite, refreshData } = get();
        const visualIndex = clips.findIndex(c => c.id === id);
        if (visualIndex === -1) return;

        const parentClip = clips[visualIndex];
        const sceneNum = parseFloat(parentClip.scene);
        if (isNaN(sceneNum)) throw new Error("Cannot duplicate: Scene number must be numeric (e.g. '1.0').");

        const newScene = (sceneNum + 0.1).toFixed(1).replace(/\.0$/, '');
        const currentList = clips.filter(c => c.series === currentSeriesId);
        const parentVisualIndex = currentList.findIndex(c => c.id === id);
        const nextClip = currentList[parentVisualIndex + 1];

        const parentOrder = parentClip.sortOrder || 0;
        const nextOrder = nextClip ? (nextClip.sortOrder || (parentOrder + 20)) : (parentOrder + 20);
        let newSortOrder = Math.round((parentOrder + nextOrder) / 2);

        const gap = nextOrder - parentOrder;
        const needsRebalance = gap <= 1 || newSortOrder === parentOrder || newSortOrder === nextOrder;

        let rebalanceUpdates: { id: string | number; sortOrder: number }[] = [];
        if (needsRebalance) {
            const insertAt = parentVisualIndex + 1;
            newSortOrder = (insertAt + 1) * 10;
            currentList.forEach((c, i) => {
                const baseIndex = i < insertAt ? i : i + 1;
                const robustOrder = (baseIndex + 1) * 10;
                if (c.sortOrder !== robustOrder) rebalanceUpdates.push({ id: c.id, sortOrder: robustOrder });
            });
        }

        const tempId = `temp-${Date.now()}`;
        const newClip: Clip = {
            ...parentClip, id: tempId, scene: newScene, sortOrder: newSortOrder,
            status: 'Ready', taskId: '', mediaReferences: parentClip.mediaReferences || []
        };

        const updatedClips = [...clips];
        updatedClips.splice(visualIndex + 1, 0, newClip);

        if (rebalanceUpdates.length > 0) {
            const updateMap = new Map(rebalanceUpdates.map(u => [u.id.toString(), u.sortOrder]));
            updatedClips.forEach(c => { if (updateMap.has(c.id)) c.sortOrder = updateMap.get(c.id)!; });
        }

        set({ clips: updatedClips });

        try {
            if (rebalanceUpdates.length > 0) await clipsApi.sort(rebalanceUpdates as any);
            const data = await clipsApi.create({ clip: newClip, sourceClipId: id });
            if (!data.success) throw new Error(data.error || 'Creation failed');
            notifyWrite();

            set((state) => ({
                clips: state.clips.map(c => c.id === tempId ? { ...c, id: data.clip.id, episode: data.clip.episode } : c)
            }));
        } catch (err) {
            console.error("Duplicate failed", err);
            set((state) => ({ clips: state.clips.filter(c => c.id !== tempId) }));
            refreshData();
            throw err;
        }
    },

    deleteClip: async (id: string) => {
        const { clips, notifyWrite, markClipDeleted } = get();
        const clip = clips.find(c => c.id === id);
        if (!clip) return;

        try {
            await clipsApi.delete(parseInt(id), clip.episode || '1');
            markClipDeleted(id);
            set((state) => ({ clips: state.clips.filter(c => c.id !== id) }));
            notifyWrite();
        } catch (err) {
            console.error("Delete Failed", err);
            throw err;
        }
    },

    refreshData: async (silent = false) => {
        const startTime = Date.now();
        if (!silent) set({ loading: true });

        try {
            const data = await clipsApi.getAll();

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

                // Smart Merge for Library Items (Preserve Task ID)
                if (data.libraryItems) {
                    const currentLibrary = state.libraryItems;
                    console.log(`[DataStore] Refresh received ${data.libraryItems.length} library items.`);
                    updates.libraryItems = (data.libraryItems || []).map((newItem: LibraryItem) => {
                        // Loose Equality for ID (String vs Number safety)
                        const existing = currentLibrary.find(i => String(i.id) === String(newItem.id));

                        const existingStatus = existing?.status?.toUpperCase() || 'IDLE';
                        const newStatus = newItem.status?.toUpperCase() || 'IDLE';

                        // Allow merge if server returns IDLE or GENERATING (race condition where DB hasn't updated or defaulted)
                        if (existing && existing.taskId && !newItem.taskId && existingStatus === 'GENERATING' && (newStatus === 'GENERATING' || newStatus === 'IDLE')) {
                            // Keep 'Generating' locally so polling continues
                            return { ...newItem, taskId: existing.taskId, model: existing.model || newItem.model, status: 'Generating' };
                        }



                        return newItem;
                    });
                }

                if (data.series) {
                    updates.seriesList = (data.series || []).map((s: any) => ({
                        ...s,
                        title: s.name || s.title || 'Untitled Series'
                    }));

                    // Auto-select first series if invalid
                    const currentId = state.currentSeriesId;
                    const exists = updates.seriesList?.find((s: Series) => s.id === currentId);

                    if (!exists && updates.seriesList && updates.seriesList.length > 0) {
                        updates.currentSeriesId = updates.seriesList[0].id; // Default to first
                    }
                }

                if (data.episodes) {
                    updates.allEpisodes = (data.episodes || []).map((e: any) => ({
                        ...e,
                        series: e.seriesId || e.series
                    }));
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
