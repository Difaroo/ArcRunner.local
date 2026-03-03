import React, { useState, useMemo } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { Clip } from '@/types';
import { getModelConfig } from '@/lib/models';
import { downloadFile, getClipFilename } from '@/lib/download-utils';
import { ActionToolbar } from './ActionToolbar';
import { ClipTable } from './ClipTable';
import { ClipConfirmDialog } from '@/components/dialogs/generation/ClipConfirmDialog';
import { useMediaPersistence } from '@/hooks/useMediaPersistence';

export const ClipsView = ({ bemOpenerRef }: { bemOpenerRef: React.MutableRefObject<any> }) => {
    const {
        clips, currentSeriesId, currentEpisode, allEpisodes, seriesList,
        libraryItems, deletedClipIds,
        updateClip, addClip, duplicateClip, deleteClip,
        setPlayingVideoUrl, setPlaylist, setCurrentPlayIndex
    } = useDataStore(s => s);

    // Local UI State
    const [selectedModel, setSelectedModel] = useState('veo-fast');
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [clipDuration, setClipDuration] = useState("5");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Generation State
    const [showClipConfirm, setShowClipConfirm] = useState(false);
    const [pendingGenerateClip, setPendingGenerateClip] = useState<Clip | null>(null);
    const [pendingGenerateExtras, setPendingGenerateExtras] = useState<any>(null);

    // Derived Values
    const currentEpObj = useMemo(() => {
        return allEpisodes.find(e => e.series === currentSeriesId && e.id === currentEpisode.toString());
    }, [allEpisodes, currentSeriesId, currentEpisode]);

    const currentEpKey = currentEpObj?.id || '1';
    const currentStyle = currentEpObj?.style || '';
    const currentAspectRatio = currentEpObj?.aspectRatio || '16:9';
    const currentSeed = currentEpObj?.seed !== undefined ? currentEpObj.seed : null;

    const rawActiveClips = clips.filter(c => c.episode === currentEpKey && c.series === currentSeriesId);

    const activeClips = useMemo(() => {
        return rawActiveClips.filter(c => !deletedClipIds.has(c.id));
    }, [rawActiveClips, deletedClipIds]);

    const selectedIds = useMemo(() => {
        return new Set(activeClips.filter(c => c.isSelected).map(c => c.id));
    }, [activeClips]);

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

    const resolveImage = (name: string) => seriesLibraryMap[name.toLowerCase()];

    const uniqueValues = {
        characters: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_CHARACTER').map(i => i.name))).sort(),
        locations: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_LOCATION').map(i => i.name))).sort(),
        styles: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_STYLE').map(i => i.name))).sort(),
        cameras: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_CAMERA').map(i => i.name))).sort(),
    };

    // Handlers
    const handleClipSelect = (id: string) => {
        const clip = activeClips.find(c => c.id === id);
        if (clip) updateClip(id, { isSelected: !clip.isSelected }).catch(console.error);
    };

    const handleClipSelectAll = () => {
        const allSelected = activeClips.length > 0 && selectedIds.size === activeClips.length;
        const targetState = !allSelected;
        const idsToUpdate = activeClips.filter(c => c.isSelected !== targetState).map(c => c.id);
        idsToUpdate.forEach(id => updateClip(id, { isSelected: targetState }));
    };

    const handleSave = async (clipId: string, updates: Partial<Clip>) => {
        setSaving(true);
        try {
            await updateClip(clipId, updates);
            setEditingId(null);
        } catch (err: any) {
            console.error('Save error:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleGenerate = async (clip: Clip, index: number, extras?: any) => {
        try {
            await updateClip(clip.id, { status: 'Generating', resultUrl: '', taskId: '', isPersisted: false });
            const styleToUse = currentStyle || "";

            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clip: { ...clip, style: styleToUse, duration: clipDuration },
                    library: allSeriesAssets,
                    model: clip.model || selectedModel || 'flux',
                    aspectRatio: currentAspectRatio,
                    sound: audioEnabled,
                    seed: currentSeed ?? undefined,
                    startFrame: extras?.startFrame,
                    rowIndex: parseInt(clip.id)
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            await updateClip(clip.id, {
                taskId: data.taskId || clip.taskId,
                resultUrl: data.resultUrl || '',
                model: clip.model || selectedModel || 'flux',
                status: data.resultUrl ? 'Done' : 'Generating' // Re-assert to prevent BEM auto-save race-condition stale overwrites
            });
        } catch (error: any) {
            await updateClip(clip.id, { status: 'Error' });
            alert(`Generation failed: ${error.message}`);
        }
    };

    const handleGenerateSingle = (clip: Clip) => {
        const config = getModelConfig(selectedModel);
        if (config?.validation?.explicitReference && (!clip.mediaReferences || clip.mediaReferences.length === 0)) {
            alert(`Validation Error: Model '${config.label}' requires a Reference Image.`);
            return;
        }
        setPendingGenerateClip(clip);
        setShowClipConfirm(true);
    };

    const handleGenerateSelected = (extras?: any) => {
        const toGen = activeClips.filter(c => selectedIds.has(c.id));
        if (toGen.length === 0) return;
        const validToGen = toGen.filter(c => c.status !== 'Pending' && !!c.status);
        if (validToGen.length === 0) {
            alert("No clips ready for generation (all selected are Red/Pending).");
            return;
        }
        setPendingGenerateExtras(extras);
        setShowClipConfirm(true);
    };

    const executeClipGeneration = async () => {
        setShowClipConfirm(false);
        if (pendingGenerateClip) {
            const clip = pendingGenerateClip;
            setPendingGenerateClip(null);
            const index = clips.findIndex(c => c.id === clip.id);
            if (index > -1) await handleGenerate(clip, index, pendingGenerateExtras);
            setPendingGenerateExtras(null);
            return;
        }

        const toGen = activeClips.filter(c => selectedIds.has(c.id) && c.status !== 'Pending' && !!c.status);
        const extras = pendingGenerateExtras;
        for (const clip of toGen) {
            const index = clips.findIndex(c => c.id === clip.id);
            await handleGenerate(clip, index, extras);
        }
        setPendingGenerateExtras(null);
    };

    const { persistMedia } = useMediaPersistence();

    const handleDownloadSelected = async () => {
        const toDownload = activeClips.filter(c => selectedIds.has(c.id) && c.resultUrl);
        if (toDownload.length === 0) return alert("No completed clips selected.");
        let successCount = 0;

        for (const clip of toDownload) {
            if (!clip.resultUrl) continue;
            const cleanUrl = clip.resultUrl.split(',')[0].trim();
            const isVideo = cleanUrl.match(/\.(mp4|mov|webm|mkv)($|\?)/i);
            try {
                if (isVideo && clip.episodeId) {
                    const result = await persistMedia({ clipId: clip.id, episodeId: clip.episodeId });
                    if (result.success) {
                        successCount++;
                        await updateClip(clip.id, { isPersisted: true, status: '' });
                    }
                } else {
                    const seriesTitle = seriesList.find(s => s.id === currentSeriesId)?.title || "Unknown_Series";
                    if (await downloadFile(cleanUrl, getClipFilename(clip, seriesTitle))) {
                        successCount++;
                        await updateClip(clip.id, { status: '' });
                    }
                    await new Promise(r => setTimeout(r, 500));
                }
            } catch (err) {
                console.error(`Failed to download ${clip.title}:`, err);
            }
        }
        alert(`Successfully processed ${successCount} of ${toDownload.length} clips.`);
    };

    const updateEpisodeSetting = async (updates: Partial<typeof currentEpObj>) => {
        if (!currentEpObj || !currentSeriesId) return;
        try {
            await fetch('/api/update_episode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seriesId: currentSeriesId, episodeId: currentEpisode.toString(), updates })
            });
            useDataStore.getState().refreshData(true);
        } catch (e) {
            console.error(e);
        }
    };

    const handleMoveSelected = async (targetEp: number) => {
        try {
            if (selectedIds.size === 0) return;
            await fetch('/api/move-clips', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clipIds: Array.from(selectedIds), targetEpisodeNumber: targetEp, currentSeriesId })
            });
            window.location.reload();
        } catch (e: any) {
            alert(`Move failed: ${e.message}`);
        }
    };

    const fetchStudioAsset = async (name: string, type: 'CHARACTER' | 'LOCATION') => {
        try {
            const res = await fetch(`/api/studio?name=${encodeURIComponent(name)}&type=LIB_${type}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (error) {
            console.error(`[fetchStudioAsset] Failed to fetch ${type} "${name}":`, error);
            return null;
        }
    };

    const handleStudioAssetView = async (name: string, type: 'CHARACTER' | 'LOCATION') => {
        const asset = await fetchStudioAsset(name, type);
        if (!asset) {
            alert(`${type.toLowerCase().charAt(0).toUpperCase() + type.toLowerCase().slice(1)} "${name}" not found in Studio`);
            return;
        }
        if (!asset.media || asset.media.length === 0) {
            alert(`${type.toLowerCase().charAt(0).toUpperCase() + type.toLowerCase().slice(1)} "${name}" has no reference images`);
            return;
        }

        const richPlaylist = asset.media
            .filter((m: any) => m.url || m.localPath)
            .map((m: any) => ({
                id: m.id,
                url: m.url || m.localPath || '',
                type: (m.type || 'IMAGE').toLowerCase() as 'video' | 'image',
                title: asset.name,
                description: asset.description || '',
                isReference: true,
                ownerClipId: `${type === 'CHARACTER' ? 'char' : 'loc'}-${asset.name}`
            }));

        if (richPlaylist.length === 0) {
            alert(`${type.toLowerCase().charAt(0).toUpperCase() + type.toLowerCase().slice(1)} "${name}" has no valid reference images`);
            return;
        }

        const firstUrl = richPlaylist[0].url;
        setPlayingVideoUrl(firstUrl);
        setPlaylist(richPlaylist);
        setCurrentPlayIndex(0);
    };

    const handleAddReference = async (clipId: string, url: string, type: 'IMAGE' | 'VIDEO') => {
        try {
            const clip = clips.find(c => c.id === clipId);
            if (clip && (clip.mediaReferences || []).some((m: any) => m.url === url)) return;

            const newMediaRef = {
                id: `temp-${Date.now()}`, url, type, category: 'REFERENCE',
                createdAt: new Date().toISOString(), refImageSort: 0
            } as any;

            await updateClip(clipId, {
                mediaReferences: [...(clip?.mediaReferences || []), newMediaRef]
            });

            const res = await fetch('/api/media/add-ref', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetClipId: clipId, url, type })
            });
            if (!res.ok) throw new Error('API Error');
            useDataStore.getState().notifyWrite();
        } catch (e) {
            console.error("Add Ref Failed", e);
            useDataStore.getState().refreshData();
        }
    };

    return (
        <div className="flex flex-1 flex-col overflow-hidden relative">
            <ActionToolbar
                currentEpKey={currentEpKey}
                episodeUuid={currentEpObj?.uuid}
                onMoveSelected={handleMoveSelected}
                totalClips={activeClips.length}
                readyClips={activeClips.filter(c => c.status === 'Ready').length}
                selectedCount={selectedIds.size}
                onGenerateSelected={handleGenerateSelected}
                onDownloadSelected={handleDownloadSelected}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                currentStyle={currentStyle}
                onStyleChange={(style) => updateEpisodeSetting({ style })}
                availableStyles={uniqueValues.styles}
                aspectRatio={currentAspectRatio}
                onAspectRatioChange={(ratio) => updateEpisodeSetting({ aspectRatio: ratio })}
                onAddClip={addClip}
                clips={activeClips}
                enableAudio={audioEnabled}
                onEnableAudioChange={setAudioEnabled}
                duration={clipDuration}
                onDurationChange={setClipDuration}
                seed={currentSeed}
                onSeedChange={(val) => updateEpisodeSetting({ seed: val })}
                onDataRefresh={() => useDataStore.getState().refreshData(true)}
                onGenerateSingle={handleGenerateSingle}
                onRegisterBEMOpener={(opener) => bemOpenerRef.current = opener}
            />
            <ClipTable
                clips={activeClips}
                selectedIds={selectedIds}
                editingId={editingId}
                saving={saving}
                onSelect={handleClipSelect}
                onSelectMultiple={(ids) => ids.forEach(id => updateClip(id, { isSelected: true }))}
                onSelectAll={handleClipSelectAll}
                onEdit={(clip) => setEditingId(clip.id)}
                onSave={handleSave}
                onCancelEdit={() => setEditingId(null)}
                onGenerate={handleGenerateSingle}
                onPlay={(url, contextPlaylist) => {
                    if (!url) return;
                    setPlayingVideoUrl(url);
                    if (contextPlaylist && contextPlaylist.length > 0) {
                        setPlaylist(contextPlaylist);
                        if (typeof contextPlaylist[0] === 'object') {
                            setCurrentPlayIndex((contextPlaylist as any).findIndex((p: any) => p.url === url) || 0);
                        } else {
                            setCurrentPlayIndex(contextPlaylist.indexOf(url));
                        }
                    } else {
                        setPlaylist([url]);
                        setCurrentPlayIndex(0);
                    }
                }}
                uniqueValues={uniqueValues}
                onDelete={deleteClip}
                onDuplicate={duplicateClip}
                onStudioAssetClick={handleStudioAssetView}
                onResolveImage={resolveImage}
                onAddReference={handleAddReference}
                seriesTitle={seriesList.find(s => s.id === currentSeriesId)?.title || 'Series'}
                activeModel={selectedModel}
                onOpenBEM={(clipId) => bemOpenerRef.current?.(clipId)}
            />
            <ClipConfirmDialog
                open={showClipConfirm}
                onOpenChange={setShowClipConfirm}
                count={pendingGenerateClip ? 1 : activeClips.filter(c => selectedIds.has(c.id)).length}
                onConfirm={executeClipGeneration}
                model={selectedModel}
                style={currentStyle}
                aspectRatio={currentAspectRatio}
            />
        </div>
    );
};
