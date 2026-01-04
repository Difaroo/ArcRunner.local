import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useStore } from "@/store/useStore"
import { Clip } from "@/types"
import { downloadFile, getClipFilename } from "@/lib/download-utils"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ClipTable } from "./ClipTable"
import { ActionToolbar } from "./ActionToolbar"
import { useSharedSelection } from "@/hooks/useSharedSelection"
import { useActiveClips } from "@/hooks/useActiveClips"

export function EpisodeView() {
    const {
        setClips,
        currentSeriesId,
        currentEpisode,
        allEpisodes,
        setAllEpisodes,
        seriesList,
        markClipDeleted,
        setPlayingVideoUrl,
        setPlaylist,
        setCurrentPlayIndex
    } = useStore()

    // --- Derived State (via Hook) ---
    const { activeClips, currentEpKey, allSeriesAssets, uniqueValues } = useActiveClips();

    // Resolve Episode Object for settings
    const currentEpObj = useMemo(() =>
        allEpisodes.find(e => e.series === currentSeriesId && e.id === currentEpKey),
        [allEpisodes, currentSeriesId, currentEpKey]
    );

    // --- Settings State ---
    const currentStyle = currentEpObj?.style || '';
    const currentAspectRatio = currentEpObj?.aspectRatio || '16:9';
    const currentSeries = seriesList.find(s => s.id === currentSeriesId);
    const targetModel = currentEpObj?.model || currentSeries?.defaultModel || 'veo-fast';

    const [selectedModel, setSelectedModel] = useState(targetModel);

    // Sync model if context changes
    useMemo(() => {
        if (targetModel !== selectedModel) setSelectedModel(targetModel);
    }, [targetModel]);


    // --- Selection & Editing State ---
    const { selectedIds, setSelectedIds, toggleSelect, toggleSelectAll } = useSharedSelection(activeClips);

    // We keep editing/saving state local.
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showClipConfirm, setShowClipConfirm] = useState(false);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);

    // --- STABLE HANDLER REFS ---
    // We use refs to access the latest state inside callbacks without re-creating functions.
    const activeClipsRef = useRef(activeClips);
    const selectedModelRef = useRef(selectedModel);
    const currentStyleRef = useRef(currentStyle);
    const currentAspectRatioRef = useRef(currentAspectRatio);
    const allSeriesAssetsRef = useRef(allSeriesAssets);
    const currentEpKeyRef = useRef(currentEpKey);
    const currentSeriesIdRef = useRef(currentSeriesId);

    useEffect(() => {
        activeClipsRef.current = activeClips;
        selectedModelRef.current = selectedModel;
        currentStyleRef.current = currentStyle;
        currentAspectRatioRef.current = currentAspectRatio;
        allSeriesAssetsRef.current = allSeriesAssets;
        currentEpKeyRef.current = currentEpKey;
        currentSeriesIdRef.current = currentSeriesId;
    });

    // --- Handlers ---

    const updateEpisodeSetting = useCallback(async (updates: Partial<any>) => {
        const sId = currentSeriesIdRef.current;
        const eId = currentEpKeyRef.current;

        // Optimistic
        setAllEpisodes(prev => prev.map(e =>
            (e.series === sId && e.id === eId) ? { ...e, ...updates } : e
        ));

        try {
            await fetch('/api/update_episode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seriesId: sId,
                    episodeId: eId,
                    updates
                })
            });
        } catch (e) {
            console.error(e);
        }
    }, [setAllEpisodes]);

    const handleSave = useCallback(async (clipId: string, updates: Partial<Clip>) => {
        setSaving(true);
        try {
            const res = await fetch('/api/update_clip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: clipId, updates }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error('Failed to save');

            if (data.success && data.clip) {
                setClips(prev => prev.map(c => c.id === clipId ? { ...c, ...data.clip } : c));
            } else {
                // Optimistic & Re-Resolve
                setClips(prev => prev.map(c => {
                    if (c.id !== clipId) return c;
                    return { ...c, ...updates };
                }));
            }
            setEditingId(null);
        } catch (err) {
            console.error(err);
            alert('Failed to save changes');
        } finally {
            setSaving(false);
        }
    }, [setClips]); // Stable dependency

    const handleGenerate = useCallback(async (clip: Clip, index: number, styleOverride?: string) => {
        const styleToUse = styleOverride !== undefined ? styleOverride : (currentStyleRef.current || clip.style);
        const modelToUse = selectedModelRef.current || 'flux';
        const aspectRatio = currentAspectRatioRef.current;
        const library = allSeriesAssetsRef.current;

        try {
            // Optimistic Status
            setClips(prev => prev.map(c => c.id === clip.id ? { ...c, status: 'Generating', resultUrl: '', taskId: '' } : c));

            const isVideo = modelToUse.startsWith('veo');
            const endpoint = isVideo ? '/api/generate' : '/api/generate-image';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clip: { ...clip, style: styleToUse },
                    library: library,
                    model: modelToUse,
                    aspectRatio: aspectRatio,
                    rowIndex: clip.id
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Update Task ID
            setClips(prev => prev.map(c => c.id === clip.id ? {
                ...c,
                resultUrl: data.resultUrl || data.taskId
            } : c));

        } catch (error: any) {
            alert(`Generation failed: ${error.message}`);
            setClips(prev => prev.map(c => c.id === clip.id ? { ...c, status: 'Error' } : c));
        }
    }, [setClips]);

    const handleDuplicateClip = useCallback(async (id: string) => {
        const activeClips = activeClipsRef.current;
        const parentClip = activeClips.find(c => c.id === id);
        if (!parentClip) return;

        const visualIndex = activeClips.findIndex(c => c.id === id);
        const nextClip = activeClips[visualIndex + 1];
        const parentOrder = parentClip.sortOrder || 0;
        const newSortOrder = nextClip ? ((parentOrder + (nextClip.sortOrder || parentOrder + 10)) / 2) : parentOrder + 10;

        const sceneNum = parseFloat(parentClip.scene) || 1;
        const newScene = (sceneNum + 0.1).toFixed(1).replace(/\.0$/, '');

        const tempId = `temp-${Date.now()}`;
        const newClip: Clip = {
            ...parentClip,
            id: tempId,
            scene: newScene,
            sortOrder: newSortOrder,
            status: 'Ready',
            resultUrl: '',
            taskId: '',
            refImageUrls: '',
            explicitRefUrls: parentClip.explicitRefUrls // Keep refs?
        };
        // Reset generated fields
        newClip.characterImageUrls = [];
        newClip.locationImageUrls = [];

        setClips((prev: Clip[]) => {
            return [...prev, newClip];
        });

        try {
            const res = await fetch('/api/clips', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clip: newClip })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setClips((prev: Clip[]) => prev.map(c => c.id === tempId ? { ...c, id: data.clip.id, episode: data.clip.episode } : c));
        } catch (e: any) {
            alert("Duplicate failed: " + e.message);
            setClips((prev: Clip[]) => prev.filter(c => c.id !== tempId));
        }
    }, [setClips]);

    // helper to find index - unlikely needed inside efficient handler
    // const getClipIndex = (id: string) => activeClips.findIndex(c => c.id === id);

    const handleAddClip = useCallback(async () => {
        const sId = currentSeriesIdRef.current;
        const eKey = currentEpKeyRef.current;
        const activeClips = activeClipsRef.current;

        if (!sId) return;

        // Determine Scene/Order
        let newSortOrder = 10;
        if (activeClips.length > 0) {
            newSortOrder = (activeClips[activeClips.length - 1].sortOrder || 0) + 10;
        }

        const tempId = `temp-${Date.now()}`;
        const newClip: Clip = {
            id: tempId,
            scene: "0",
            sortOrder: newSortOrder,
            status: 'Ready',
            resultUrl: '',
            taskId: '',
            refImageUrls: '', explicitRefUrls: '',
            episode: eKey,
            series: sId,
            title: 'New Clip',
            character: '', location: '', action: '', camera: '', style: '', dialog: ''
        };

        setClips(prev => [newClip, ...prev]); // Prepend? or Append? previous code prepended but sort order implied append.

        try {
            const res = await fetch('/api/clips', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clip: newClip })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setClips(prev => prev.map(c => c.id === tempId ? { ...c, id: data.clip.id, episode: data.clip.episode } : c));
        } catch (e: any) {
            alert("Failed to add: " + e.message);
            setClips(prev => prev.filter(c => c.id !== tempId));
        }
    }, [setClips]);

    const executeBatchGeneration = useCallback(async () => {
        setShowClipConfirm(false);
        const activeClips = activeClipsRef.current;
        const toGen = activeClips.filter(c => selectedIds.has(c.id));
        setCopyMessage(`Generating ${toGen.length} clips...`);
        setTimeout(() => setCopyMessage(null), 3000);

        for (const clip of toGen) {
            // We can reuse handleGenerate, but iterating might cause overlapping state updates if not careful?
            // handleGenerate modifies state optimistically.
            // It's safe.
            await handleGenerate(clip, 0);
        }
    }, [handleGenerate, selectedIds]);

    const handleDownloadSelected = useCallback(async () => {
        const activeClips = activeClipsRef.current;
        const toDownload = activeClips.filter(c => selectedIds.has(c.id) && c.resultUrl);
        if (toDownload.length === 0) return alert("No completed clips selected.");
        for (const clip of toDownload) {
            if (clip.resultUrl) {
                const filename = getClipFilename(clip);
                await downloadFile(clip.resultUrl, filename);
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }, [selectedIds]);

    const handleSetEditingId = useCallback((id: string | null) => {
        setEditingId(id);
    }, []); // Stable

    const handleSelect = useCallback((id: string) => {
        toggleSelect(id);
    }, [toggleSelect]);
    // Note: toggleSelect depends on useSharedSelection implementation. 
    // If we fixed useSharedSelection to be stable, this is stable.

    const handlePlay = useCallback((url: string) => {
        if (url) {
            setPlayingVideoUrl(url);
            setPlaylist([url]);
            setCurrentPlayIndex(0);
        }
    }, [setPlayingVideoUrl, setPlaylist, setCurrentPlayIndex]);

    const handleEditStart = useCallback((clip: Clip) => {
        setEditingId(clip.id);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingId(null);
    }, []);

    const handleGenerateWrapper = useCallback((clip: Clip) => {
        handleGenerate(clip, 0);
    }, [handleGenerate]);

    const handleResolveImage = useCallback((name: string) => {
        const item = allSeriesAssetsRef.current.find(i => i.name.toLowerCase() === name.toLowerCase());
        return item?.refImageUrl;
    }, []);


    const handleDelete = useCallback((id: string) => {
        markClipDeleted(id);
    }, [markClipDeleted]);

    // Derived values for Duplicate / Delete wrappers if needed, but we pass directly.

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="border-b border-border/40 bg-background/50 backdrop-blur-sm">
                <ActionToolbar
                    currentEpKey={currentEpKey}
                    totalClips={activeClips.length}
                    readyClips={activeClips.filter(c => c.status === 'Done').length}
                    selectedCount={selectedIds.size}

                    onGenerateSelected={() => {
                        if (selectedIds.size > 0) setShowClipConfirm(true)
                    }}
                    onDownloadSelected={handleDownloadSelected}

                    selectedModel={selectedModel}
                    onModelChange={async (model) => {
                        setSelectedModel(model);
                        localStorage.setItem("selectedModel", model);
                        updateEpisodeSetting({ model });
                    }}

                    currentStyle={currentStyle}
                    onStyleChange={(s) => updateEpisodeSetting({ style: s })}
                    availableStyles={uniqueValues.styles}

                    aspectRatio={currentAspectRatio}
                    onAspectRatioChange={(r) => updateEpisodeSetting({ aspectRatio: r })}

                    onAddClip={handleAddClip}
                    clips={activeClips}
                />
                {copyMessage && (
                    <div className="absolute top-16 right-6 text-xs text-green-500 bg-black/80 px-2 py-1 rounded z-50">
                        {copyMessage}
                    </div>
                )}
            </div>

            {/* Main Table */}
            <div className="flex-1 overflow-hidden p-6">
                <div className="rounded-lg border border-border/40 bg-card/50 shadow-sm backdrop-blur-sm h-full flex flex-col">
                    <ClipTable
                        clips={activeClips}
                        selectedIds={selectedIds}
                        editingId={editingId}
                        saving={saving}
                        onSelectAll={toggleSelectAll}
                        onSelect={handleSelect}

                        onEdit={handleEditStart}
                        onCancelEdit={handleCancelEdit}
                        onSave={handleSave}

                        onGenerate={handleGenerateWrapper}
                        onPlay={handlePlay}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicateClip}
                        uniqueValues={uniqueValues}
                        seriesTitle={currentSeries?.title || 'Series'}
                        onResolveImage={handleResolveImage}
                    />
                </div>
            </div>

            {/* Confirm Dialog */}
            <Dialog open={showClipConfirm} onOpenChange={setShowClipConfirm}>
                <DialogContent className="sm:max-w-[400px] bg-stone-900 border-stone-800 text-stone-100 p-6">
                    <DialogHeader><DialogTitle>Confirm Clip Generation</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-2">
                        <p className="text-sm text-stone-400">Generating <span className="text-white font-bold">{selectedIds.size}</span> clips.</p>
                        <div className="grid grid-cols-2 gap-2 text-sm bg-black/20 p-3 rounded-md border border-white/5">
                            <span className="text-stone-500">View</span><span className="text-right font-medium">{currentAspectRatio}</span>
                            <span className="text-stone-500">Style</span><span className="text-right font-medium truncate">{currentStyle || 'None'}</span>
                            <span className="text-stone-500">Model</span><span className="text-right font-medium truncate">{selectedModel}</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowClipConfirm(false)}>Cancel</Button>
                        <Button onClick={executeBatchGeneration}>Generate</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
