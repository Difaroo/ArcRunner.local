'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Clip } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { VibeItem } from './VibeItem';
import { MediaDisplay } from '@/components/media/MediaDisplay';
import { useMediaPersistence } from '@/hooks/useMediaPersistence';
import { Loader2, Download, AlertCircle } from 'lucide-react';
import { ClipAssetScroller } from './ClipAssetScroller';
import { ModelInputSlotsV2 } from './ModelInputSlotsV2';
import { getModelConfig } from '@/lib/models';
import { resolveManifest } from '@/lib/structural-manifest';
import { getComputedClipStatus } from '@/lib/clip-status';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

// VibesMenu Imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface BatchEditModalProps {
    clips: Clip[];
    initialIndex: number;
    isOpen: boolean;
    onClose: () => void;
    onSave: (clipId: string, updates: Partial<Clip>) => Promise<void>;
    onDataRefresh?: () => void;
    seriesId: string;
    episodeId?: string;
    defaultModel?: string;
}

export function BatchEditModalV3({
    clips,
    initialIndex,
    isOpen,
    onClose,
    onSave,
    onDataRefresh,
    seriesId,
    episodeId,
    defaultModel = 'veo-fast'
}: BatchEditModalProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);



    const safeIndex = Math.min(currentIndex, Math.max(0, clips.length - 1));
    const currentClip = clips[safeIndex];

    // Priority: Toolbar Selection (defaultModel) > Clip Override > System Default
    // User wants BEM to reflect the "Episode Model" (Toolbar).
    const effectiveModel = defaultModel || currentClip?.model || 'veo-fast';

    console.log('[BEM] Init:', { clipModel: currentClip?.model, defaultModel, effectiveModel });
    const canGoUp = safeIndex > 0;
    const canGoDown = safeIndex < clips.length - 1;

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(Math.min(initialIndex, Math.max(0, clips.length - 1)));
        }
    }, [isOpen, initialIndex, clips.length]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isOpen) return;
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'ArrowUp' && canGoUp) {
            e.preventDefault();
            setCurrentIndex(prev => prev - 1);
        } else if (e.key === 'ArrowDown' && canGoDown) {
            e.preventDefault();
            setCurrentIndex(prev => prev + 1);
        } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            const saveButton = document.querySelector('[data-save-trigger]') as HTMLButtonElement;
            if (saveButton) saveButton.click();
        }
    }, [isOpen, canGoUp, canGoDown, onClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleSaveClip = useCallback(async (updates: Partial<Clip>) => {
        if (!currentClip) return;
        setIsSaving(true);
        try {
            await onSave(currentClip.id, updates);
            onDataRefresh?.();
        } catch (error) {
            console.error('Save failed:', error);
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [currentClip, onSave, onDataRefresh]);

    const handleNavigate = useCallback((direction: 'up' | 'down') => {
        if (direction === 'up' && canGoUp) {
            setCurrentIndex(prev => prev - 1);
        } else if (direction === 'down' && canGoDown) {
            setCurrentIndex(prev => prev + 1);
        }
    }, [canGoUp, canGoDown]);

    if (!isOpen || clips.length === 0 || !currentClip) return null;

    const structuralStatus = getComputedClipStatus(currentClip);

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
            <div className="w-full h-full max-w-[95vw] max-h-[95vh] bg-stone-950 border border-stone-800 rounded-lg flex flex-col overflow-hidden">
                {/* Top Bar */}
                <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 mr-1">
                            <div className={`w-3 h-3 rounded-full bg-red-500 ${structuralStatus.state === 'Pending' || structuralStatus.isError ? 'opacity-100 ring-2 ring-white/20' : 'opacity-30'}`} />
                            <div className={`w-3 h-3 rounded-full bg-orange-500 ${structuralStatus.state === 'Ready' ? 'opacity-100 ring-2 ring-white/20' : 'opacity-30'}`} />
                            <div className={`w-3 h-3 rounded-full bg-green-500 ${(structuralStatus.state === 'Done' || structuralStatus.state === 'Complete' || structuralStatus.state === 'Generating') ? 'opacity-100 ring-2 ring-white/20' : 'opacity-30'}`} />
                        </div>
                        <span className="text-lg text-stone-400">{currentClip.scene || safeIndex + 1}</span>
                        <h2 className="text-lg font-normal text-white">{currentClip.title || `Scene ${safeIndex + 1}`}</h2>
                        {currentClip.isSelected && (
                            <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded">Selected</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-stone-400">{safeIndex + 1} / {clips.length} CLIPS</span>
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" onClick={() => handleNavigate('up')} disabled={!canGoUp} className="h-7 w-7 border-orange-500 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400 disabled:opacity-50">
                                <span className="material-symbols-outlined !text-xl">keyboard_arrow_up</span>
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => handleNavigate('down')} disabled={!canGoDown} className="h-7 w-7 border-orange-500 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400 disabled:opacity-50">
                                <span className="material-symbols-outlined !text-xl">keyboard_arrow_down</span>
                            </Button>
                        </div>
                        <div className="w-px h-6 bg-stone-700" />
                        <Button variant="ghost" size="icon" onClick={() => (document.querySelector('[data-save-trigger]') as HTMLButtonElement)?.click()} disabled={isSaving || !isDirty} className="h-7 w-7 bg-primary hover:bg-primary/80 text-primary-foreground disabled:opacity-50 disabled:bg-primary/50">
                            <span className="material-symbols-outlined !text-base">{isSaving ? 'hourglass_empty' : 'save'}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-primary hover:bg-primary/20">
                            <span className="material-symbols-outlined !text-base">close</span>
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden p-4">
                    <BatchEditContent
                        clip={currentClip}
                        seriesId={seriesId}
                        episodeId={episodeId}
                        onSave={handleSaveClip}
                        isSaving={isSaving}
                        onNavigate={handleNavigate}
                        model={effectiveModel}
                        onDirtyChange={setIsDirty}
                        onDataRefresh={onDataRefresh}
                    />
                </div>
            </div>
        </div>
    );
}

// ========== BatchEditContent Component ==========

interface BatchEditContentProps {
    clip: Clip;
    seriesId: string;
    episodeId?: string;
    onSave: (updates: Partial<Clip>) => Promise<void>;
    isSaving: boolean;
    onNavigate: (direction: 'up' | 'down') => void;
    model: string;
    onDirtyChange?: (isDirty: boolean) => void;
    onDataRefresh?: () => void;
}

function BatchEditContent({ clip, seriesId, episodeId, onSave, isSaving, onNavigate, model, onDirtyChange, onDataRefresh }: BatchEditContentProps) {
    const derivedStatus = getComputedClipStatus(clip);
    const [activeField, setActiveField] = useState<'character' | 'location' | 'camera' | 'movement' | 'action' | 'dialog' | 'media'>('character');
    const [lastVibeId, setLastVibeId] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [mediaItems, setMediaItems] = useState<any[]>([]);

    // Explicit sizing for Safari flex aspect-ratio bug
    const slotContainerRef = useRef<HTMLDivElement>(null);
    const [calculatedSlotWidth, setCalculatedSlotWidth] = useState<number | null>(null);

    // Manual Panel Persistence (autoSaveId buggy on remount)
    // We initialize lazily to avoid hydration mismatch, then let the effect take over.
    const [initialLayout, setInitialLayout] = useState<number[] | null>(null);

    useEffect(() => {
        const saved = sessionStorage.getItem('arcrunner-bem-vertical-layout');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length === 2) {
                    setInitialLayout(parsed);
                    return;
                }
            } catch (e) {
                // pass through to default
            }
        }
        setInitialLayout([40, 60]);
    }, []);

    // Native DOM fallback for persistence, since react-resizable-panels events are swallowed
    useEffect(() => {
        if (!initialLayout) return; // Wait for initial render

        const observer = new MutationObserver(() => {
            const topPanel = document.getElementById('bem-top-panel');
            const bottomPanel = document.getElementById('bem-bottom-panel');
            if (topPanel && bottomPanel) {
                // Read the actual flex percentage applied by the library
                const topFlex = parseFloat(topPanel.style.flexGrow || '0');
                const bottomFlex = parseFloat(bottomPanel.style.flexGrow || '0');
                if (topFlex > 0 && bottomFlex > 0) {
                    const total = topFlex + bottomFlex;
                    const topPct = (topFlex / total) * 100;
                    const bottomPct = (bottomFlex / total) * 100;
                    sessionStorage.setItem('arcrunner-bem-vertical-layout', JSON.stringify([topPct, bottomPct]));
                }
            }
        });

        // The library creates the DOM nodes slightly after mount
        const timer = setTimeout(() => {
            const topPanel = document.getElementById('bem-top-panel');
            if (topPanel) {
                observer.observe(topPanel, { attributes: true, attributeFilter: ['style'] });
            }
        }, 500);

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [initialLayout]);

    // Track width changes of the model input slots using ResizeObserver
    useEffect(() => {
        if (!slotContainerRef.current) return;

        const findFlexRow = () => slotContainerRef.current?.querySelector('.debug-port-verified') as HTMLElement | null;

        const updateWidth = () => {
            const row = findFlexRow();
            if (row) {
                const totalNeeded = row.getBoundingClientRect().width + 12 + 2;
                setCalculatedSlotWidth(totalNeeded);
            }
        };

        const flexRow = findFlexRow();
        if (!flexRow) {
            const timer = setTimeout(updateWidth, 50);
            return () => clearTimeout(timer);
        }

        const observer = new ResizeObserver(() => updateWidth());
        observer.observe(flexRow);

        updateWidth();

        return () => observer.disconnect();
    }, [model, clip?.id, mediaItems]); // Re-evaluate when model, clip, or media changes

    useEffect(() => {
        if (!episodeId) return;
        fetch(`/api/media?episodeId=${episodeId}&seriesId=${seriesId}`)
            .then(res => res.ok ? res.json() : [])
            .then(data => setMediaItems(Array.isArray(data) ? data : []))
            .catch(console.error);
    }, [episodeId]);

    const [localReferences, setLocalReferences] = useState<any[]>(clip.mediaReferences || []);

    useEffect(() => {
        setLocalReferences(clip.mediaReferences || []);
    }, [clip.id, clip.mediaReferences]);

    const handleAddToSlot = async (item: any) => {
        // Calculate next sort order based on current clip's explicit references
        const currentSlots = localReferences.filter(m => m.refImageSort && m.refImageSort > 0);
        const maxSort = currentSlots.length > 0 ? Math.max(...currentSlots.map(m => m.refImageSort)) : 0;
        const newSort = maxSort + 1;

        // Optimistic UI Update
        const tempId = `temp-${Date.now()}`;
        const newRef = {
            id: tempId,
            url: item.url,
            type: item.type || 'IMAGE',
            category: 'REFERENCE',
            refImageSort: newSort
        };

        setLocalReferences(prev => [...prev, newRef]);
        if (status === 'Pending' || !status) setStatus('Ready');

        try {
            // Persist: Copy the item to a new REFERENCE record linked to the clip
            const res = await fetch('/api/media/add-ref', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: item.url,
                    targetClipId: clip.id,
                    action: 'copy'
                })
            });
            const data = await res.json();

            if (data.success && data.mediaId) {
                // Apply sort order to the new copied record
                await fetch('/api/media', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: data.mediaId, refImageSort: newSort })
                });

                // Hot-swap temp ID
                setLocalReferences(prev => prev.map(r => r.id === tempId ? { ...r, id: data.mediaId } : r));

                if (onDataRefresh) {
                    onDataRefresh();
                }
            } else {
                throw new Error("Failed to link reference item to clip.");
            }
        } catch (e) {
            console.error(e);
            // Revert
            setLocalReferences(prev => prev.filter(r => r.id !== tempId));
        }
    };

    const handleRemoveFromSlot = async (item: any) => {
        // item is derived from uiSlots -> explicitItems -> localReferences
        setLocalReferences(prev => prev.filter(m => m.id !== item.id));
        if (status === 'Pending' || !status) setStatus('Ready');

        try {
            // Unlink physically deletes the explicit relation Media record without destroying the file
            await fetch('/api/media/unlink', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: item.url,
                    clipId: clip.id,
                    isResult: false
                })
            });

            if (onDataRefresh) {
                onDataRefresh();
            }
        } catch (e) {
            console.error(e);
            // We ignore revert logic here, removal is generally safe.
        }
    };

    const [editValues, setEditValues] = useState({
        character: clip.character || '',
        location: clip.location || '',
        style: clip.style || '',
        camera: clip.camera || '',
        movement: clip.movement || '',
        action: clip.action || '',
        dialog: clip.dialog || '',
        negativePrompt: clip.negativePrompt || ''
    });

    const [status, setStatus] = useState<string>(clip.status || 'Pending');

    useEffect(() => {
        setEditValues({
            character: clip.character || '',
            location: clip.location || '',
            style: clip.style || '',
            camera: clip.camera || '',
            movement: clip.movement || '',
            action: clip.action || '',
            dialog: clip.dialog || '',
            negativePrompt: clip.negativePrompt || ''
        });
        setSaveError(null);
        setLastVibeId(null);
        setStatus(clip.status || 'Pending');
    }, [clip.id, clip.status]);

    useEffect(() => {
        // Compute Dirty State anytime editValues or status changes
        // Compare current editValues with clip
        const isModified =
            editValues.character !== (clip.character || '') ||
            editValues.location !== (clip.location || '') ||
            editValues.style !== (clip.style || '') ||
            editValues.camera !== (clip.camera || '') ||
            editValues.movement !== (clip.movement || '') ||
            editValues.action !== (clip.action || '') ||
            editValues.dialog !== (clip.dialog || '') ||
            editValues.negativePrompt !== (clip.negativePrompt || '') ||
            status !== (clip.status || 'Pending');

        onDirtyChange?.(isModified);
    }, [editValues, status, clip, onDirtyChange]);

    // --- RE-IMPLEMENT Auto-Population using editValues for real-time reactivity ---
    // Use editValues for the text fields logic, fallback to clip for unmodified
    const targetStyle = editValues.style ?? clip.style ?? '';
    const targetLoc = editValues.location ?? clip.location ?? '';
    const targetChar = editValues.character ?? clip.character ?? '';

    // --- Structural Manifest Resolution ---
    // Use the Shared Logic (Source of Truth) to determine what goes into the slots
    const manifest = React.useMemo(() => {
        // Prepare context for resolver
        // We have `mediaItems` which are all available media.
        // We need to categorize them for the LibraryContext

        // 1. Find Style
        const styleItem = mediaItems.find(i => targetStyle && i.name === targetStyle.toLowerCase());

        // 2. Find Location
        const locItems = mediaItems.filter(i => targetLoc && i.category?.includes('LOCATION') && i.name?.toLowerCase().includes(targetLoc.toLowerCase())).map(i => i.url);

        // 3. Find Characters
        // This is tricky because `mediaItems` is a flat list. Current logic tried to match based on `editValues.character`.
        // We need to emulate `resolveClipImages` logic or just do a best-effort match here.
        // For BEM, we assume `targetChar` is a comma-separated list? 
        // Existing code: `targetChar && item.category?.includes('CHARACTER')`
        const charItems = mediaItems.filter(i => targetChar && i.category?.includes('CHARACTER') && targetChar.toLowerCase().includes(i.name?.toLowerCase() || '___')).map(i => i.url);

        // 4. Explicit Refs
        // Using the locally managed specific clip references instead of the global media pool.
        const explicitItems = localReferences
            .filter(i => i.refImageSort && i.refImageSort > 0)
            .map(i => ({
                id: i.id,
                url: i.url,
                refImageSort: i.refImageSort
            })) as any;

        return resolveManifest(
            clip,
            model,
            {
                styleImage: styleItem?.url,
                locationImages: locItems,
                characterImages: charItems
            },
            explicitItems
        );
    }, [mediaItems, editValues, clip, model, targetStyle, targetLoc, targetChar]);

    // Map Manifest Slots to UI Items
    // ModelInputSlotsV2 expects `mediaItems` with `refImageSort` to order them.
    // But `manifest.slots` IS the ordered list.
    // We can pass `manifest.slots` directly if we adapt ModelInputSlotsV2, OR we map back to a list of items.
    // Let's adapt `mediaItems` passed to slots to ONLY be the manifest slots.

    const uiSlots = React.useMemo(() => {
        return manifest.slots.map(slot => ({
            id: slot.id,
            url: slot.url,
            name: slot.label, // Semantic Name: e.g. "Start Frame"
            type: 'IMAGE', // Mock
            category: slot.type.toUpperCase(),
            isAutoPopulated: slot.isAutoPopulated, // Forward flag for UI lock
            refImageSort: slot.sortOrder // Retain sort order metadata loosely
        }));
    }, [manifest]);

    // --- End Structural Resolution ---

    const handleFieldChange = (field: keyof typeof editValues, value: string) => {
        setEditValues(prev => ({ ...prev, [field]: value }));
        if (status === 'Pending') setStatus('Ready');
    };

    const handleVibeSelect = (vibeId: string | null, value: string, field: keyof typeof editValues) => {
        setLastVibeId(vibeId);
        handleFieldChange(field, value);
    };

    const handleRefreshVibe = async () => {
        if (!lastVibeId) return;
        try {
            await fetch('/api/vibes', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: lastVibeId, prompt: editValues.action })
            });
        } catch (error) { setSaveError('Failed to update vibe'); }
    };

    const handleCreateVibe = async () => {
        if (!editValues.action.trim()) return;
        try {
            const response = await fetch('/api/vibes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editValues.action.slice(0, 30) + '...',
                    prompt: editValues.action,
                    type: 'ACTION',
                    seriesId
                })
            });
            const newVibe = await response.json();
            setLastVibeId(newVibe.id);
        } catch (error) { setSaveError('Failed to create vibe'); }
    };

    const handleSave = async () => {
        setSaveError(null);
        try {
            await onSave({
                character: editValues.character,
                location: editValues.location,
                camera: editValues.camera,
                movement: editValues.movement,
                action: editValues.action,
                dialog: editValues.dialog,
                negativePrompt: editValues.negativePrompt,
                status: status
            });
        } catch (error) { setSaveError('Failed to save changes'); }
    };

    if (!initialLayout) {
        return <div className="h-full w-full flex items-center justify-center text-stone-500">Loading layout...</div>;
    }

    return (
        <ResizablePanelGroup direction="vertical" className="h-full w-full">
            <ResizablePanel
                id="bem-top-panel"
                defaultSize={initialLayout[0]}
                minSize={20}
                className="pb-2"
            >
                <div className="h-full flex flex-row gap-4 min-h-0 w-full overflow-hidden">
                    {/* Top Row: Asset Pool */}
                    <div className="flex-1 min-w-0 flex-shrink bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800 min-h-0">
                        <div className="px-3 pt-3 pb-1 flex justify-between items-center">
                            <h3 className="text-xs text-stone-400 font-medium uppercase tracking-wider">Asset Pool</h3>
                            <span className="text-xs text-stone-600 font-mono">
                                {mediaItems.filter(m => !m.refImageSort || m.refImageSort === 0).length}
                            </span>
                        </div>
                        <ClipAssetScroller
                            mediaItems={mediaItems}
                            onSelect={handleAddToSlot}
                            isLoading={false}
                            orientation="horizontal"
                            className="flex-1 w-full"
                            onUpdate={async (id, updates) => {
                                const item = mediaItems.find(m => m.id === id);
                                if (!item) return;
                                try {
                                    if (item.isStudioItem) {
                                        await fetch('/api/library', {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ id: item.studioItemId, description: updates.description })
                                        });
                                    } else {
                                        await fetch('/api/media', {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ id, action: updates.action, description: updates.description })
                                        });
                                    }
                                    if (onDataRefresh) onDataRefresh();
                                } catch (e) {
                                    console.error('Failed to update media item from pool', e);
                                }
                            }}
                        />
                    </div>

                    {/* Top Row: Slots */}
                    <div
                        ref={slotContainerRef}
                        style={{ width: calculatedSlotWidth ? `${calculatedSlotWidth}px` : undefined }}
                        className={`flex-none ${calculatedSlotWidth ? '' : 'w-fit'} bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800 relative transition-[width] duration-75`}
                    >
                        <div className="px-2 pt-3 pb-1 w-fit">
                            <h3 className="text-xs text-stone-400 font-medium uppercase tracking-wider">{getModelConfig(model).label}</h3>
                        </div>
                        <div className="px-1.5 pb-2 pt-0 h-full w-fit">
                            <ModelInputSlotsV2
                                modelConfig={getModelConfig(model)}
                                mediaItems={uiSlots as any}
                                onRemove={handleRemoveFromSlot}
                                orientation="horizontal"
                                className=""
                            />
                        </div>
                    </div>

                    {/* Top Row: Result */}
                    <div className="h-full aspect-video flex-shrink-0 bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800">
                        <div className="px-3 pt-3 pb-1 flex justify-between items-center bg-stone-950/20 backdrop-blur-sm z-10">
                            <h3 className="text-xs text-orange-500 uppercase tracking-wider font-medium drop-shadow-md">Latest Result</h3>
                        </div>
                        <div className="flex-1 relative bg-black flex items-center justify-center min-h-0 w-full">
                            {derivedStatus.state === 'Generating' ? (
                                <div className="flex flex-col items-center justify-center gap-3 text-primary">
                                    <Loader2 className="h-8 w-8 animate-spin opacity-80" />
                                    <span className="text-xs font-mono uppercase tracking-widest text-primary/80">Generating...</span>
                                </div>
                            ) : clip.resultUrl ? (
                                <MediaDisplay
                                    url={clip.resultUrl}
                                    ownerClipId={clip.id}
                                />
                            ) : (
                                <span className="text-stone-600 text-xs uppercase tracking-widest">No Generation</span>
                            )}
                        </div>
                    </div>
                </div>
            </ResizablePanel>

            <ResizableHandle withHandle direction="vertical" className="bg-transparent" />

            <ResizablePanel id="bem-bottom-panel" defaultSize={initialLayout[1]} minSize={20} className="pt-2">
                <div className="h-full flex flex-row gap-4 min-h-0 w-full overflow-hidden">
                    {/* Bottom Row: Vibes Menu (Col 1 equivalent) */}
                    <div className="w-[13rem] flex-shrink-0 rounded-lg overflow-hidden flex flex-col bg-stone-900/30 border border-stone-800/50 min-h-0">
                        <div className="p-2 pt-4 h-full flex flex-col min-h-0">
                            <VibesMenu
                                seriesId={seriesId}
                                episodeId={episodeId}
                                activeField={activeField}
                                model={model}
                                onSelectVibe={(vibeId, value) => {
                                    if (activeField === 'action') {
                                        handleVibeSelect(vibeId, value, 'action');
                                    } else if (activeField === 'movement') {
                                        handleVibeSelect(vibeId, value, 'movement');
                                    } else if (activeField === 'dialog') {
                                        handleFieldChange('dialog', editValues.dialog + (editValues.dialog ? '\n' : '') + value);
                                    }
                                }}
                                onStudioAssetClick={(name, type) => {
                                    if (type === 'CHARACTER') {
                                        const chars = editValues.character.split(',').map(c => c.trim()).filter(Boolean);
                                        if (chars.includes(name)) {
                                            handleFieldChange('character', chars.filter(c => c !== name).join(', '));
                                        } else {
                                            handleFieldChange('character', [...chars, name].join(', '));
                                        }
                                    } else if (type === 'LOCATION') {
                                        handleFieldChange('location', name);
                                    } else if (type === 'CAMERA') {
                                        handleFieldChange('camera', name);
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Bottom Row: Fields (Span 3 equivalent) */}
                    <div className="flex-1 min-w-0 bg-stone-900/50 rounded-lg p-4 overflow-y-auto border border-stone-800/50">
                        <div className="grid grid-cols-3 gap-4 h-full">
                            <div className="flex flex-col gap-3">
                                <div><div className="h-7 mb-1 flex items-center"><label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Character</label></div><input type="text" value={editValues.character} onChange={(e) => handleFieldChange('character', e.target.value)} onFocus={() => setActiveField('character')} className="modal-field h-8 text-xs leading-4" /></div>
                                <div><div className="h-7 mb-1 flex items-center"><label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Location</label></div><input type="text" value={editValues.location} onChange={(e) => handleFieldChange('location', e.target.value)} onFocus={() => setActiveField('location')} className="modal-field h-8 text-xs leading-4" /></div>
                                <div><div className="h-7 mb-1 flex items-center"><label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Camera</label></div><input type="text" value={editValues.camera} onChange={(e) => handleFieldChange('camera', e.target.value)} onFocus={() => setActiveField('camera')} className="modal-field h-8 text-xs leading-4" /></div>
                                <div><div className="h-7 mb-1 flex items-center"><label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Movement</label></div><input type="text" value={editValues.movement} onChange={(e) => handleFieldChange('movement', e.target.value)} onFocus={() => setActiveField('movement')} className="modal-field h-8 text-xs leading-4" /></div>
                            </div>
                            <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between h-7 mb-1">
                                    <label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Action</label>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" onClick={handleRefreshVibe} disabled={!lastVibeId} className="h-6 w-6 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400"><span className="material-symbols-outlined !text-sm">refresh</span></Button>
                                        <Button variant="ghost" size="icon" onClick={handleCreateVibe} disabled={!editValues.action.trim()} className="h-6 w-6 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400"><span className="material-symbols-outlined !text-sm">add</span></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleFieldChange('action', '')} className="h-6 w-6 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400"><span className="material-symbols-outlined !text-sm">clear_all</span></Button>
                                        <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(editValues.action)} className="h-6 w-6 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400"><span className="material-symbols-outlined !text-sm">content_copy</span></Button>
                                    </div>
                                </div>
                                <textarea value={editValues.action} onChange={(e) => handleFieldChange('action', e.target.value)} onFocus={() => setActiveField('action')} className="modal-field flex-1 py-1.5 resize-none text-xs leading-4" />
                            </div>
                            <div className="flex flex-col gap-3 h-full">
                                <div className="flex-[3] flex flex-col min-h-0">
                                    <div className="h-7 mb-1 flex items-center"><label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Dialog</label></div>
                                    <textarea value={editValues.dialog} onChange={(e) => handleFieldChange('dialog', e.target.value)} onFocus={() => setActiveField('dialog')} className="modal-field flex-1 py-1.5 resize-none text-xs leading-4" />
                                </div>
                                <div className="flex-[2] flex flex-col min-h-0">
                                    <div className="h-7 mb-1 flex items-center"><label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Negate</label></div>
                                    <textarea value={editValues.negativePrompt} onChange={(e) => handleFieldChange('negativePrompt', e.target.value)} className="modal-field flex-1 py-1.5 resize-none text-xs leading-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </ResizablePanel>

            <button data-save-trigger onClick={handleSave} className="hidden" aria-hidden="true" />
            {saveError && <div className="text-destructive text-sm text-center">{saveError}</div>}
        </ResizablePanelGroup>
    );
}

// ========== VibesMenu Full Component ==========

interface StudioAsset {
    id: number;
    name: string;
    type: string;
    thumbnailPath?: string;
}

interface Vibe {
    id: string;
    title: string;
    prompt: string;
    type: string;
    sortOrder: number;
    seriesId: string | null;
}

interface VibesMenuProps {
    seriesId: string;
    episodeId?: string;
    activeField: 'character' | 'location' | 'camera' | 'movement' | 'action' | 'dialog' | 'media';
    onSelectVibe: (vibeId: string | null, value: string) => void;
    onStudioAssetClick: (name: string, type: string) => void;
    refreshTrigger?: number; // Prop trigger for live updates
    model: string;
}

function SortableVibeItem({ vibe, onSelect, onUpdate }: { vibe: Vibe, onSelect: () => void, onUpdate: (v: any) => Promise<void> }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: vibe.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <VibeItem vibe={vibe} onSelect={onSelect} onUpdate={onUpdate} />
        </div>
    );
}

function VibesMenu({ seriesId, episodeId, activeField, onSelectVibe, onStudioAssetClick, refreshTrigger, model }: VibesMenuProps) {
    const [studioAssets, setStudioAssets] = useState<StudioAsset[]>([]);
    const [vibes, setVibes] = useState<Vibe[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (activeField === 'action') {
                    const res = await fetch(`/api/vibes?seriesId=${seriesId}&type=ACTION`);
                    if (res.ok) {
                        setVibes(await res.json());
                        setStudioAssets([]);
                    }
                } else {
                    const typeMap: Record<string, string> = {
                        character: 'LIB_CHARACTER',
                        location: 'LIB_LOCATION',
                        camera: 'LIB_CAMERA',
                        movement: 'LIB_MOVEMENT',
                        dialog: 'LIB_CHARACTER'
                    };
                    if (activeField === 'movement' || activeField === 'camera') {
                        const res = await fetch(`/api/vibes?seriesId=${seriesId}&type=${activeField.toUpperCase()}`);
                        if (res.ok) {
                            const data = await res.json();
                            setVibes(Array.isArray(data) ? data : []);
                            setStudioAssets([]);
                        }
                        return;
                    }
                    const assetType = typeMap[activeField];
                    if (assetType) {
                        const res = await fetch(`/api/library?seriesId=${seriesId}&type=${assetType}`);
                        if (res.ok) {
                            const data = await res.json();
                            setStudioAssets(Array.isArray(data) ? data : []);
                            setVibes([]);
                        }
                    }
                }
            } catch (err) {
                console.error('VibesMenu fetch error:', err);
                setError('Failed to load menu items');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [activeField, seriesId, episodeId, refreshTrigger]);

    const getMenuTitle = () => {
        const titles: Record<string, string> = {
            character: 'CHARACTERS',
            location: 'LOCATION',
            camera: 'CAMERA',
            movement: 'MOVEMENT',
            action: 'ACTION VIBES',
            dialog: 'CHARACTERS',
            media: 'EPISODE MEDIA'
        };
        return titles[activeField] || 'MENU';
    };

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="h-7 mb-1 shrink-0 flex items-center pl-2">
                <h3 className="text-xs text-primary uppercase tracking-wider font-normal">{getMenuTitle()}</h3>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-2">
                {isLoading && <div className="text-stone-500 text-sm">Loading...</div>}
                {error && <div className="text-destructive text-sm">{error}</div>}

                {!isLoading && studioAssets.length > 0 && (
                    <div className="space-y-1">
                        {studioAssets.map((asset) => (
                            <button key={asset.id} onClick={() => {
                                if (activeField === 'dialog') onSelectVibe(null, `[${asset.name}]: ""`);
                                else onStudioAssetClick(asset.name, asset.type.replace('LIB_', ''));
                            }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-stone-800 text-left transition-colors">
                                {asset.thumbnailPath && (
                                    <img src={asset.thumbnailPath.split(',')[0].trim()} alt={asset.name} className="w-8 h-8 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                )}
                                <span className="text-xs text-stone-300 truncate font-normal">{asset.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {!isLoading && vibes.length > 0 && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={async (event) => {
                        const { active, over } = event;
                        if (active.id !== over?.id) {
                            setVibes((items) => {
                                const oldIndex = items.findIndex((i) => i.id === active.id);
                                const newIndex = items.findIndex((i) => i.id === over?.id);
                                const newItems = arrayMove(items, oldIndex, newIndex);
                                const updates = newItems.map((item, index) => ({ id: item.id, sortOrder: index }));
                                fetch('/api/vibes/reorder', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: updates }) }).catch(console.error);
                                return newItems;
                            });
                        }
                    }}>
                        <SortableContext items={vibes.map(v => v.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-1">
                                {vibes.map((vibe) => (
                                    <SortableVibeItem key={vibe.id} vibe={vibe} onSelect={() => onSelectVibe(vibe.id, vibe.prompt)} onUpdate={async (updatedVibe) => {
                                        await fetch('/api/vibes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedVibe) });
                                        setVibes(prev => prev.map(v => v.id === updatedVibe.id ? { ...v, ...updatedVibe } : v));
                                    }} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}

                {!isLoading && studioAssets.length === 0 && vibes.length === 0 && (
                    <div className="text-stone-500 text-sm">No items found</div>
                )}
            </div>
        </div>
    );
}

export { BatchEditContent, VibesMenu };
