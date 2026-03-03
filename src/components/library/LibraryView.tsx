import React, { useState, useMemo, useEffect } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { useSharedSelection } from '@/hooks/useSharedSelection';
import { LibraryTable } from './LibraryTable';
import { LibraryActionToolbar } from './LibraryActionToolbar';
import { StudioConfirmDialog } from '@/components/dialogs/generation/StudioConfirmDialog';

interface LibraryViewProps {
    currentSeriesId: string;
    currentEpKey: string;
    currentStyle?: string;
    currentGuidance?: number;
    currentAspectRatio?: string;
    currentSeed?: string | number | null;
    archiveMedia: (currentUrl: string | null) => Promise<void>;
    updateEpisodeSetting: (updates: any) => void;
}

export default function LibraryView({
    currentSeriesId,
    currentEpKey,
    currentStyle,
    currentGuidance = 0.5,
    currentAspectRatio = '16:9',
    currentSeed,
    archiveMedia,
    updateEpisodeSetting
}: LibraryViewProps) {
    const {
        libraryItems, setLibraryItems,
        seriesList, allEpisodes,
        deletedLibraryIds, markLibraryItemDeleted,
        setPlayingVideoUrl, setPlaylist, setCurrentPlayIndex
    } = useDataStore(s => s);

    // --- Derived Data ---
    const allSeriesAssets = useMemo(() =>
        libraryItems.filter(i => i.series === currentSeriesId),
        [libraryItems, currentSeriesId]
    );

    const currentLibraryItems = useMemo(() =>
        allSeriesAssets.filter(item => item.episode === currentEpKey && !deletedLibraryIds.has(item.id)),
        [allSeriesAssets, currentEpKey, deletedLibraryIds]
    );

    const uniqueValues = useMemo(() => ({
        styles: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_STYLE').map(i => i.name))).sort(),
    }), [allSeriesAssets]);

    // --- Selection logic ---
    const {
        selectedIds: selectedLibraryIds,
        setSelectedIds: setSelectedLibraryIds,
        toggleSelect: toggleLibrarySelect,
        toggleSelectAll: toggleLibrarySelectAll
    } = useSharedSelection(currentLibraryItems);

    useEffect(() => {
        setSelectedLibraryIds(new Set());
    }, [currentSeriesId, setSelectedLibraryIds]);

    // --- Local State ---
    const [generatingLibraryItems, setGeneratingLibraryItems] = useState<Set<string>>(new Set());
    const [showStudioConfirm, setShowStudioConfirm] = useState(false);
    const [studioSelectedModel, setStudioSelectedModel] = useState('nano-banana-pro');
    const [copyMessage, setCopyMessage] = useState<string | null>(null);

    // --- Handlers ---
    const handleLibrarySave = async (index: string, updates: Partial<any>) => {
        const effectiveUpdates = { ...updates };
        if ('refImageUrl' in effectiveUpdates) {
            effectiveUpdates.status = '';
        }

        try {
            const res = await fetch('/api/update_library', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowIndex: index,
                    updates: effectiveUpdates
                }),
            });

            if (!res.ok) throw new Error('Failed to save library item');

            const newLibraryItems = libraryItems.map((item) =>
                item.id === index ? { ...item, ...updates } : item
            );
            setLibraryItems(newLibraryItems);
        } catch (err) {
            console.error('Library Save error:', err);
            alert('Failed to save library item');
            throw err;
        }
    };

    const handleDeleteLibraryItem = (id: string) => {
        markLibraryItemDeleted(id);
    };

    const handleDuplicateLibraryItem = async (id: string) => {
        // Currently relying on page.tsx persistence/add-library behavior? Let's just implement the basic structure.
        alert("Duplicate functionality pending implementation via standard API.");
    };

    const handleAddLibraryItem = async () => {
        if (!currentSeriesId) {
            alert("No active series found. Cannot create item.");
            return;
        }

        const tempId = `temp-lib-${Date.now()}`;
        const newItem = {
            id: tempId,
            series: currentSeriesId,
            name: "New Item",
            type: "LIB_CHARACTER",
            description: "",
            refImageUrl: "",
            negatives: "",
            notes: "",
            episode: currentEpKey || "1",
            status: "Ready",
            created_at: new Date().toISOString()
        };
        try {
            await fetch('/api/update_library', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item: newItem, isNew: true })
            });
            setLibraryItems([...libraryItems, newItem as any]);
        } catch (e) {
            console.error(e);
            alert("Failed to add library item");
        }
    };

    const generateLibraryItem = async (item: any) => {
        const rowIndex = parseInt(item.id);
        setGeneratingLibraryItems(prev => new Set(prev).add(item.id));

        const epKey = item.episode || '1';
        const styleToUse = allEpisodes.find(e => e.series === currentSeriesId && e.id === epKey)?.style || '';
        const currentSeriesDirect = seriesList.find(s => s.id === currentSeriesId);
        const resolvedModel = item.model || currentSeriesDirect?.defaultModel || 'flux-2/flex-image-to-image';

        try {
            const res = await fetch('/api/generate-library', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item,
                    rowIndex,
                    style: styleToUse,
                    styleStrength: currentGuidance,
                    seed: currentSeed ?? undefined,
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
            alert("Generation failed: " + e);
        } finally {
            setGeneratingLibraryItems(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
    };

    const executeStudioGeneration = async () => {
        if (selectedLibraryIds.size === 0) return;
        setShowStudioConfirm(false);
        const toGen = currentLibraryItems.filter(item => selectedLibraryIds.has(item.id));
        setCopyMessage(`Generating ${toGen.length} library items...`);
        setTimeout(() => setCopyMessage(null), 3000);

        for (const item of toGen) {
            await generateLibraryItem(item);
        }
    };

    const handleLibraryDownloadSelected = async () => {
        const toDownload = currentLibraryItems.filter(item => selectedLibraryIds.has(item.id) && item.refImageUrl);
        if (toDownload.length === 0) return alert("No completed items selected.");

        const downloadFile = async (url: string, filename: string) => {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                const a = document.createElement("a");
                document.body.appendChild(a);
                a.href = window.URL.createObjectURL(blob);
                a.download = filename;
                a.click();
                document.body.removeChild(a);
            } catch (err) {
                console.error("Error downloading", err);
            }
        };

        for (const item of toDownload) {
            if (!item.refImageUrl) continue;
            const ext = item.refImageUrl.split('.').pop()?.split('?')[0] || 'png';
            const filename = `${item.name}.${ext}`;
            await downloadFile(item.refImageUrl, filename);
            await new Promise(r => setTimeout(r, 200));
        }
    };

    const handleStudioModelChange = async (modelId: string) => {
        setStudioSelectedModel(modelId);
        localStorage.setItem('studioSelectedModel', modelId);

        if (selectedLibraryIds.size === 0) return;
        const val = modelId === 'default' ? null : modelId;
        setCopyMessage(`Updating ${selectedLibraryIds.size} items...`);

        const promises = Array.from(selectedLibraryIds).map(id =>
            handleLibrarySave(id, { model: val })
        );

        await Promise.all(promises);
        setCopyMessage(null);
    };

    return (
        <>
            <div className="flex items-center">
                <LibraryActionToolbar
                    totalItems={currentLibraryItems.length}
                    selectedCount={selectedLibraryIds.size}
                    onGenerateSelected={() => setShowStudioConfirm(true)}
                    onDownloadSelected={handleLibraryDownloadSelected}
                    currentStyle={currentStyle || ''}
                    onStyleChange={(style: string) => updateEpisodeSetting({ style })}
                    availableStyles={uniqueValues.styles}
                    onAddItem={handleAddLibraryItem}
                    styleStrength={currentGuidance}
                    onStyleStrengthChange={(val: number) => updateEpisodeSetting({ guidance: val })}
                    seed={currentSeed ? Number(currentSeed) : null}
                    onSeedChange={(val: number | null) => updateEpisodeSetting({ seed: val })}
                    aspectRatio={currentAspectRatio}
                    onAspectRatioChange={(ratio: string) => updateEpisodeSetting({ aspectRatio: ratio })}
                    selectedModel={studioSelectedModel}
                    onModelChange={handleStudioModelChange}
                />
                {copyMessage && <span className="ml-4 text-sm text-green-500">{copyMessage}</span>}
            </div>

            <div className="flex-1 mt-4">
                <LibraryTable
                    key={`library-${currentSeriesId}-${currentEpKey}`}
                    items={currentLibraryItems}
                    onSave={handleLibrarySave}
                    selectedItems={selectedLibraryIds}
                    onSelect={toggleLibrarySelect}
                    onSelectAll={toggleLibrarySelectAll}
                    onGenerate={generateLibraryItem}
                    isGenerating={(id: string) => generatingLibraryItems.has(id)}
                    onPlay={(url: string, contextPlaylist?: string[]) => {
                        setPlayingVideoUrl(url);
                        if (contextPlaylist && contextPlaylist.length > 0) {
                            setPlaylist(contextPlaylist);
                            if (typeof contextPlaylist[0] === 'object') {
                                const index = contextPlaylist.findIndex((p: any) => p.url === url);
                                setCurrentPlayIndex(index !== -1 ? index : 0);
                            } else {
                                setCurrentPlayIndex(contextPlaylist.indexOf(url));
                            }
                        } else {
                            setPlaylist([url]);
                            setCurrentPlayIndex(0);
                        }
                    }}
                    onDelete={handleDeleteLibraryItem}
                    onDuplicate={handleDuplicateLibraryItem}
                    onArchive={archiveMedia}
                />
            </div>

            <StudioConfirmDialog
                open={showStudioConfirm}
                onOpenChange={setShowStudioConfirm}
                count={selectedLibraryIds.size}
                onConfirm={executeStudioGeneration}
                model={studioSelectedModel}
                style={currentStyle || ''}
                aspectRatio={currentAspectRatio || '16:9'}
                guidance={currentGuidance}
                seed={currentSeed ? Number(currentSeed) : null}
            />
        </>
    );
}
