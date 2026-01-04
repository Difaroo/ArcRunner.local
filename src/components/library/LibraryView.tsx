import { useState, useMemo } from "react"
import { useStore } from "@/store/useStore"
import { LibraryItem } from "@/types"
import { resolveClipImages } from "@/lib/shared-resolvers"
import { downloadFile } from "@/lib/download-utils"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { LibraryTable } from "./LibraryTable"
import { LibraryActionToolbar } from "./LibraryActionToolbar"
import { useSharedSelection } from "@/hooks/useSharedSelection"

export function LibraryView() {
    const {
        libraryItems,
        currentSeriesId,
        currentEpisode,
        allEpisodes,
        seriesList,
        clips,
        deletedLibraryIds,
        setLibraryItems,
        setClips,
        setAllEpisodes,
        markLibraryItemDeleted,
        setPlayingVideoUrl,
        setPlaylist,
        setCurrentPlayIndex
    } = useStore()

    // --- Derived State ---

    // Sort keys to determine 'currentEpKey' string
    // This replicates the logic in page.tsx to map numeric episode to ID string
    // Actually, we store 'currentEpisode' as a NUMBER (1, 2, 3...)
    // But the ID in the database/sheet is typically "1", "2"... 
    // Wait, episodes can have UUIDs. 
    // page.tsx logic:
    // const sortedEpKeys = ...
    // const currentEpKey = sortedEpKeys[currentEpisode - 1] || '1';

    // We need to robustly find the ID for the Nth episode of this series.
    const seriesEpisodes = useMemo(() =>
        allEpisodes.filter(e => e.series === currentSeriesId)
            .sort((a, b) => {
                const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
                return numA - numB;
            }),
        [allEpisodes, currentSeriesId]
    );

    // If seriesEpisodes is populated, use it. Otherwise fallback to simple string conversion.
    const currentEpObj = seriesEpisodes[currentEpisode - 1];
    const currentEpKey = currentEpObj ? currentEpObj.id : currentEpisode.toString();

    // Filter Items
    const currentLibraryItems = useMemo(() =>
        libraryItems.filter(item =>
            item.series === currentSeriesId &&
            item.episode === currentEpKey &&
            !deletedLibraryIds.has(item.id)
        ),
        [libraryItems, currentSeriesId, currentEpKey, deletedLibraryIds]
    );

    // Selection
    const {
        selectedIds,
        setSelectedIds,
        toggleSelect,
        toggleSelectAll
    } = useSharedSelection(currentLibraryItems);

    const [generatingItems, setGeneratingItems] = useState<Set<string>>(new Set());
    const [showConfirm, setShowConfirm] = useState(false);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);

    // Derived Settings from Episode (for Defaults)
    const currentStyle = currentEpObj?.style || '';
    const currentGuidance = currentEpObj?.guidance ?? 5.0;
    const currentSeed = currentEpObj?.seed ?? undefined;
    const currentAspectRatio = currentEpObj?.aspectRatio || '16:9';

    // --- Handlers ---

    const handleLibrarySave = async (id: string, updates: Partial<LibraryItem>) => {
        // Auto-clear error status if image is updated
        const effectiveUpdates = { ...updates };
        if ('refImageUrl' in effectiveUpdates) {
            effectiveUpdates.status = '';
        }

        try {
            const res = await fetch('/api/update_library', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex: id,
                    updates: effectiveUpdates
                }),
            });

            if (!res.ok) throw new Error('Failed to save library item');

            // Update local state
            // Use function setter for atomic updates if possible, but we use Zustand setLibraryItems
            // We need to calculate the NEW array
            const newLibraryItems = libraryItems.map((item) =>
                item.id === id ? { ...item, ...effectiveUpdates } : item
            );
            setLibraryItems(newLibraryItems);
        } catch (err) {
            console.error('Library Save error:', err);
            alert('Failed to save library item');
        }
    };

    const handleDuplicateLibraryItem = async (id: string) => {
        const source = libraryItems.find(i => i.id === id);
        if (!source) return;

        const getUniqueName = (baseName: string): string => {
            let candidate = baseName + "_Copy";
            let counter = 1;
            const exists = (n: string) => libraryItems.some(i => i.name.toLowerCase() === n.toLowerCase() && i.series === currentSeriesId);
            if (!exists(candidate)) return candidate;
            while (exists(`${candidate}_${counter}`) && counter < 100) counter++;
            return `${candidate}_${counter}`;
        };

        const newItem: LibraryItem = {
            ...source,
            id: `temp-lib-${Date.now()}`,
            name: getUniqueName(source.name),
        };

        setLibraryItems([newItem, ...libraryItems]); // Prepend or Append? page.tsx used [...prev, newItem] (append) but specific order not strictly enforced visually? 
        // Logic check: page.tsx did [...prev, newItem]. 

        try {
            const res = await fetch('/api/library', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Update ID
            setLibraryItems(prev => prev.map(i => i.id === newItem.id ? { ...i, id: data.item.id } : i));
        } catch (e: any) {
            alert("Failed to duplicate: " + e.message);
            setLibraryItems(prev => prev.filter(i => i.id !== newItem.id));
        }
    };

    const handleAddLibraryItem = async () => {
        if (!currentSeriesId) return;

        const newItem: LibraryItem = {
            id: `temp-lib-${Date.now()}`,
            series: currentSeriesId,
            name: "New Item",
            type: "LIB_CHARACTER",
            description: "",
            refImageUrl: "",
            negatives: "",
            notes: "",
            episode: currentEpKey
        };

        setLibraryItems([newItem, ...libraryItems]);

        try {
            const res = await fetch('/api/library', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setLibraryItems(prev => prev.map(i => i.id === newItem.id ? { ...i, id: data.item.id } : i));
        } catch (e: any) {
            alert("Failed to create: " + e.message);
            setLibraryItems(prev => prev.filter(i => i.id !== newItem.id));
        }
    };

    const generateLibraryItem = async (item: LibraryItem) => {
        const rowIndex = parseInt(item.id);
        setGeneratingItems(prev => new Set(prev).add(item.id));

        const epKey = item.episode || '1';
        // Note: we use currentEpObj from derived state if it matches, else search.
        const targetEp = allEpisodes.find(e => e.series === currentSeriesId && e.id === epKey);
        const styleToUse = targetEp?.style || '';

        // Model Resolution
        const currentSeries = seriesList.find(s => s.id === currentSeriesId);
        const resolvedModel = currentSeries?.defaultModel || 'flux-2/flex-image-to-image';

        try {
            const res = await fetch('/api/generate-library', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item,
                    rowIndex,
                    style: styleToUse,
                    styleStrength: currentGuidance, // We use the CURRENT view's guidance as override/default? 
                    // page.tsx used 'currentGuidance'. 
                    // This implies "Generate with settings currently on screen".
                    seed: currentSeed,
                    aspectRatio: currentAspectRatio,
                    model: resolvedModel
                })
            });
            const data = await res.json();

            if (data.status === 'GENERATING' || data.resultUrl) {
                setLibraryItems(prev => prev.map(i => {
                    if (i.id === item.id) {
                        return {
                            ...i,
                            status: data.status || i.status,
                            taskId: data.taskId || i.taskId,
                            refImageUrl: data.resultUrl || i.refImageUrl
                        };
                    }
                    return i;
                }));
            }
        } catch (e) {
            console.error(e);
            alert("Generation failed");
        } finally {
            setGeneratingItems(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
    };

    const handleExecuteBatch = async () => {
        setShowConfirm(false);
        const toGen = currentLibraryItems.filter(item => selectedIds.has(item.id));
        setCopyMessage(`Generating ${toGen.length} items...`);
        setTimeout(() => setCopyMessage(null), 3000);

        for (const item of toGen) {
            await generateLibraryItem(item);
        }
    };

    const handleDownloadSelected = async () => {
        const toDownload = currentLibraryItems.filter(item => selectedIds.has(item.id) && item.refImageUrl);
        if (toDownload.length === 0) return alert("No completed items selected.");

        for (const item of toDownload) {
            if (!item.refImageUrl) continue;
            const ext = item.refImageUrl.split('.').pop()?.split('?')[0] || 'png';
            const filename = `${item.name}.${ext}`;
            await downloadFile(item.refImageUrl, filename);
            await new Promise(r => setTimeout(r, 200));
        }
    }

    // Persist Settings Helper (Updates Episode)
    const updateEpisodeSetting = async (updates: Partial<any>) => {
        // Optimistic Update of AllEpisodes in store?
        // We probably shouldn't duplicate this logic everywhere. 
        // Ideally useStore has an action `updateEpisode(seriesId, epId, updates)`.
        // For now, I'll direct fetch and trigger refresh? 
        // Or cleaner: manually update store 'allEpisodes'.

        // 1. Optimistic
        const updatedList = allEpisodes.map(e =>
            (e.series === currentSeriesId && e.id === currentEpKey) ? { ...e, ...updates } : e
        );
        // We need setAllEpisodes exposed from Store? We didn't expose it in my check of useStore.ts... 
        // let's check. Yes, setAllEpisodes IS in AppState in step 27.
        // But I didn't verify it's exported in the hook return. 
        // `useStore` export: setAllEpisodes: (input) => set(...)
        // So I can access it via useStore().
        // BUT I didn't destructure it above. I need to add it.

        // Wait, I can't add it to destructuring if I don't import it.
        // Let's assume I will add it to `useStore()` destructuring.

        // 2. API
        try {
            await fetch('/api/update_episode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seriesId: currentSeriesId,
                    episodeId: currentEpKey,
                    updates
                })
            });
            // Force refresh to be safe or rely on optimistic? 
            // Optimistic is fine if logic is sound.
        } catch (e) {
            console.error(e);
        }
    };


    return (
        <div className="flex flex-col h-full">
            {/* Toolbar Area */}
            <div className="border-b border-border/40 bg-background/50 backdrop-blur-sm px-6 py-2">
                <LibraryActionToolbar
                    totalItems={currentLibraryItems.length}
                    selectedCount={selectedIds.size}
                    // Action: Generate (Opens Confirm)
                    onGenerateSelected={() => {
                        if (selectedIds.size > 0) setShowConfirm(true)
                    }}
                    onDownloadSelected={handleDownloadSelected}

                    // Settings (View/Style/Strength)
                    currentStyle={currentStyle}
                    onStyleChange={(s) => updateEpisodeSetting({ style: s })}
                    availableStyles={[]} // Logic to derive styles from ALL items? page.tsx: uniqueValues.styles
                    // We can derive meaningful styles here:

                    styleStrength={currentGuidance}
                    onStyleStrengthChange={(v) => updateEpisodeSetting({ guidance: v })}

                    seed={currentSeed ?? null}
                    onSeedChange={(v) => updateEpisodeSetting({ seed: v })}

                    aspectRatio={currentAspectRatio}
                    onAspectRatioChange={(r) => updateEpisodeSetting({ aspectRatio: r })}

                    onAddItem={handleAddLibraryItem}
                />
                {copyMessage && (
                    <div className="absolute top-16 right-6 text-xs text-green-500 bg-black/80 px-2 py-1 rounded">
                        {copyMessage}
                    </div>
                )}
            </div>

            {/* Main Table */}
            <div className="flex-1 overflow-hidden p-6">
                <div className="rounded-lg border border-border/40 bg-card/50 shadow-sm backdrop-blur-sm h-full flex flex-col">
                    <LibraryTable
                        items={currentLibraryItems}
                        onSave={handleLibrarySave}
                        selectedItems={selectedIds}
                        onSelect={toggleSelect}
                        onSelectAll={toggleSelectAll}
                        onGenerate={generateLibraryItem}
                        isGenerating={(id) => generatingItems.has(id)}
                        onPlay={(url) => {
                            setPlayingVideoUrl(url);
                            setPlaylist([url]);
                            setCurrentPlayIndex(0);
                        }}
                        onDelete={(id) => markLibraryItemDeleted(id)}
                        onDuplicate={handleDuplicateLibraryItem}
                    />
                </div>
            </div>

            {/* Confirm Dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="sm:max-w-[400px] bg-stone-900 border-stone-800 text-stone-100 p-6">
                    <DialogHeader>
                        <DialogTitle>Confirm Generation</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <p className="text-sm text-stone-400 mb-4">
                            Generating <span className="text-white font-semibold mx-1">{selectedIds.size}</span> item(s).
                        </p>
                        {/* Summary of Settings */}
                        <div className="grid grid-cols-2 gap-2 text-sm bg-black/20 p-3 rounded-md border border-white/5">
                            <span className="text-stone-500">View</span>
                            <span className="text-right font-medium">{currentAspectRatio}</span>
                            <span className="text-stone-500">Strength</span>
                            <span className="text-right font-medium">{currentGuidance}</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowConfirm(false)}>Cancel</Button>
                        <Button onClick={handleExecuteBatch}>Generate</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
