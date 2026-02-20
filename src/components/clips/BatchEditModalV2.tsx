'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

import { Clip } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { VibeItem } from './VibeItem';
import { MediaDisplay } from '@/components/media/MediaDisplay';
import { useMediaPersistence } from '@/hooks/useMediaPersistence';
import { Loader2, Download, AlertCircle } from 'lucide-react';
import { ClipAssetScroller } from './ClipAssetScroller';
import { ModelInputSlots } from './ModelInputSlots';
import { getModelConfig } from '@/lib/models';

interface BatchEditModalProps {
    clips: Clip[];
    initialIndex: number;
    isOpen: boolean;
    onClose: () => void;
    onSave: (clipId: string, updates: Partial<Clip>) => Promise<void>;
    onDataRefresh?: () => void; // Issue #4 fix
    seriesId: string;
    episodeId?: string;
}
export function BatchEditModal({
    clips,
    initialIndex,
    isOpen,
    onClose,
    onSave,
    onDataRefresh,
    seriesId,
    episodeId
}: BatchEditModalProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<'wip' | 'ready' | 'done'>('wip');

    // Derive values that depend on state/props (computed before hooks that need them)
    const safeIndex = Math.min(currentIndex, Math.max(0, clips.length - 1));
    const currentClip = clips[safeIndex];
    const canGoUp = safeIndex > 0;
    const canGoDown = safeIndex < clips.length - 1;

    // Reset index when modal opens or clips change
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(Math.min(initialIndex, Math.max(0, clips.length - 1)));
        }
    }, [isOpen, initialIndex, clips.length]);

    // Issue #9 fix: Keyboard shortcuts - MUST be before any conditional returns!
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isOpen) return; // Guard inside callback instead of before hook
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
            // Trigger save via ref or state
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
            onDataRefresh?.(); // Issue #4 fix
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

    // Issue #10 fix: Validate clips array - AFTER all hooks!
    if (!isOpen || clips.length === 0 || !currentClip) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
            <div className="w-full h-full max-w-[95vw] max-h-[95vh] bg-stone-950 border border-stone-800 rounded-lg flex flex-col overflow-hidden">
                {/* Top Bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800">
                    {/* Left: Scene Number + Title */}
                    <div className="flex items-center gap-2">
                        {/* Traffic Lights */}
                        <div className="flex items-center gap-1.5 mr-1">
                            {/* Red: Pending/WIP */}
                            <button
                                // onClick={(e) => { e.stopPropagation(); setStatus('Pending'); }} // This will be handled by BatchEditContent
                                className={`w-3 h-3 rounded-full bg-red-500 ${currentClip.status === 'Pending' ? 'opacity-100 ring-2 ring-white/20' : 'opacity-30 hover:opacity-100'}`}
                                title="Work in progress (Do not generate)"
                                aria-label="Set status to Work in Progress"
                            />

                            {/* Orange: Ready */}
                            <button
                                // onClick={(e) => { e.stopPropagation(); setStatus('Ready'); }} // This will be handled by BatchEditContent
                                className={`w-3 h-3 rounded-full bg-orange-500 ${currentClip.status === 'Ready' ? 'opacity-100 ring-2 ring-white/20' : 'opacity-30 hover:opacity-100'}`}
                                title="Ready to generate"
                                aria-label="Set status to Ready"
                            />

                            {/* Green: Done/Generating */}
                            <button
                                // onClick={(e) => { e.stopPropagation(); setStatus('Done'); }} // This will be handled by BatchEditContent
                                className={`w-3 h-3 rounded-full bg-green-500 ${(currentClip.status === 'Done' || currentClip.status === 'Generating') ? 'opacity-100 ring-2 ring-white/20' : 'opacity-30 hover:opacity-100'}`}
                                title="Generation complete"
                                aria-label="Set status to Done"
                            />
                        </div>
                        <span className="text-lg text-stone-400">
                            {currentClip.scene || safeIndex + 1}
                        </span>
                        <h2 className="text-lg font-normal text-white">
                            {currentClip.title || `Scene ${safeIndex + 1}`}
                        </h2>
                        {currentClip.isSelected && (
                            <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded">
                                Selected
                            </span>
                        )}
                    </div>
                    {/* Right: Clip Counter + Navigation */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-stone-400">
                            {safeIndex + 1} / {clips.length} CLIPS
                        </span>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleNavigate('up')}
                                disabled={!canGoUp}
                                className="h-7 w-7 border-orange-500 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400 disabled:opacity-50 disabled:border-orange-500 disabled:text-orange-500"
                                aria-label="Previous clip"
                            >
                                <span className="material-symbols-outlined !text-xl">keyboard_arrow_up</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleNavigate('down')}
                                disabled={!canGoDown}
                                className="h-7 w-7 border-orange-500 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400 disabled:opacity-50 disabled:border-orange-500 disabled:text-orange-500"
                                aria-label="Next clip"
                            >
                                <span className="material-symbols-outlined !text-xl">keyboard_arrow_down</span>
                            </Button>
                        </div>
                        <div className="w-px h-6 bg-stone-700" />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                // Trigger save via the BatchEditContent component
                                const saveButton = document.querySelector('[data-save-trigger]') as HTMLButtonElement;
                                if (saveButton) saveButton.click();
                            }}
                            disabled={isSaving}
                            className="h-7 w-7 bg-primary hover:bg-primary/80 text-primary-foreground"
                            aria-label="Save changes"
                        >
                            <span className="material-symbols-outlined !text-base">{isSaving ? 'hourglass_empty' : 'save'}</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-7 w-7 text-primary hover:bg-primary/20"
                            aria-label="Close modal"
                        >
                            <span className="material-symbols-outlined !text-base">close</span>
                        </Button>
                    </div>
                </div>

                {/* Content Area - will contain BatchEditContent */}
                <div className="flex-1 overflow-hidden p-4">
                    <BatchEditContent
                        clip={currentClip}
                        seriesId={seriesId}
                        episodeId={episodeId}
                        onSave={handleSaveClip}
                        isSaving={isSaving}
                        onNavigate={handleNavigate}
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
}

function BatchEditContent({ clip, seriesId, episodeId, onSave, isSaving, onNavigate }: BatchEditContentProps) {
    const [activeField, setActiveField] = useState<'character' | 'location' | 'camera' | 'movement' | 'action' | 'dialog' | 'media'>('character');
    const [lastVibeId, setLastVibeId] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Phase 3: Media State (Lifted from VibesMenu)
    const [mediaItems, setMediaItems] = useState<any[]>([]);

    // Load available media
    useEffect(() => {
        if (!episodeId) return;
        fetch(`/api/media?episodeId=${episodeId}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch media');
                return res.json();
            })
            .then(data => setMediaItems(Array.isArray(data) ? data : []))
            .catch(console.error);
    }, [episodeId]);

    // Slot Handlers
    const handleAddToSlot = async (item: any) => {
        const currentSlots = mediaItems.filter(m => m.refImageSort && m.refImageSort > 0);
        const maxSort = currentSlots.length > 0 ? Math.max(...currentSlots.map(m => m.refImageSort)) : 0;
        const newSort = maxSort + 1;

        const updatedItem = { ...item, refImageSort: newSort };
        setMediaItems(prev => prev.map(m => m.id === item.id ? updatedItem : m));

        try {
            await fetch('/api/media', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, refImageSort: newSort })
            });
        } catch (e) {
            console.error("Failed to update sort", e);
        }
    };

    const handleRemoveFromSlot = async (item: any) => {
        const updatedItem = { ...item, refImageSort: 0 };
        setMediaItems(prev => prev.map(m => m.id === item.id ? updatedItem : m));

        try {
            await fetch('/api/media', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, refImageSort: 0 })
            });
        } catch (e) {
            console.error("Failed to update sort", e);
        }
    };



    // Issue #1 FIX: Sync editValues when clip changes
    const [editValues, setEditValues] = useState({
        character: clip.character || '',
        location: clip.location || '',
        camera: clip.camera || '',
        movement: clip.movement || '',
        action: clip.action || '',
        dialog: clip.dialog || '',
        negativePrompt: clip.negativePrompt || ''
    });

    // Traffic Light Status Logic
    // Red = Pending (Default)
    // Orange = Ready (On Edit)
    // Green = Generating/Done
    const [status, setStatus] = useState<string>(clip.status || 'Pending');

    // Issue #1 FIX: useEffect to reset form when clip changes
    useEffect(() => {
        setEditValues({
            character: clip.character || '',
            location: clip.location || '',
            camera: clip.camera || '',
            movement: clip.movement || '',
            action: clip.action || '',
            dialog: clip.dialog || '',
            negativePrompt: clip.negativePrompt || ''
        });
        setSaveError(null);
        setLastVibeId(null);
        setStatus(clip.status || 'Pending'); // Reset status when clip changes
    }, [clip.id, clip.status]); // Re-run when clip ID or status changes

    const handleFieldChange = (field: keyof typeof editValues, value: string) => {
        setEditValues(prev => ({ ...prev, [field]: value }));

        // Traffic Light: Auto-switch to Ready (Orange) on edit
        if (status === 'Pending') {
            setStatus('Ready');
        }
    };

    // Issue #8 FIX: Track vibe ID when selecting from menu
    const handleVibeSelect = (vibeId: string | null, value: string, field: keyof typeof editValues) => {
        setLastVibeId(vibeId);
        handleFieldChange(field, value);
    };

    // Issue #5 FIX: Error handling for refresh vibe
    const handleRefreshVibe = async () => {
        if (!lastVibeId) return;
        try {
            await fetch('/api/vibes', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: lastVibeId, prompt: editValues.action })
            });
        } catch (error) {
            console.error('Failed to refresh vibe:', error);
            setSaveError('Failed to update vibe');
        }
    };

    // Issue #5 FIX: Error handling for create vibe
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
        } catch (error) {
            console.error('Failed to create vibe:', error);
            setSaveError('Failed to create vibe');
        }
    };

    const handleClearAction = () => {
        handleFieldChange('action', '');
        setLastVibeId(null);
    };

    const handleCopyAction = async () => {
        try {
            await navigator.clipboard.writeText(editValues.action);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    // Issue #5 & #7 FIX: Error handling and loading state for save
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
        } catch (error) {
            setSaveError('Failed to save changes');
        }
    };

    return (
        <div className="h-full flex flex-col gap-4">

            {/* TOP ROW: Holistic Dashboard (Assets & Result) - 40% Height approx */}
            <div className="flex-[2] flex gap-4 min-h-0 border-b border-stone-800/50 pb-4">

                {/* 1. Asset Pool (Left Column - Vertical) */}
                <div className="flex-1 bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800">
                    <div className="px-3 pt-3 pb-1">
                        <h3 className="text-xs text-stone-500 uppercase tracking-wider font-semibold">Asset Pool</h3>
                    </div>
                    <ClipAssetScroller
                        mediaItems={mediaItems}
                        onSelect={handleAddToSlot}
                        isLoading={false}
                        orientation="vertical"
                        className="flex-1 w-full"
                    />
                </div>

                {/* 2. Middle Column: Slots (Horizontal) */}
                <div className="flex-[2.5] bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800">
                    <div className="px-3 pt-3 pb-1">
                        <h3 className="text-xs text-amber-500 uppercase tracking-wider font-semibold">Generation Inputs</h3>
                    </div>
                    <ModelInputSlots
                        modelConfig={getModelConfig(clip.model || 'veo-fast')}
                        mediaItems={mediaItems}
                        onRemove={handleRemoveFromSlot}
                        orientation="horizontal"
                        className="flex-1 overflow-x-auto px-4 pb-2 pt-0 gap-4"
                    />
                </div>

                {/* 3. Right Column: Result */}
                <div className="flex-[1.5] bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800">
                    <div className="px-3 pt-3 pb-1">
                        <h3 className="text-xs text-amber-500 uppercase tracking-wider font-semibold">Latest Result</h3>
                    </div>
                    <div className="flex-1 relative bg-black flex items-center justify-center">
                        {clip.resultUrl ? (
                            (clip.resultUrl.includes('.mp4') || clip.resultUrl.includes('.webm')) ? (
                                <video src={clip.resultUrl} controls className="max-w-full max-h-full" />
                            ) : (
                                <img src={clip.resultUrl} alt="Result" className="max-w-full max-h-full object-contain" />
                            )
                        ) : (
                            <span className="text-stone-600 text-xs uppercase tracking-widest">No Generation</span>
                        )}
                    </div>
                </div>
            </div>


            {/* BOTTOM ROW: Controls & Metadata */}
            <div className="flex-[2] flex gap-4 min-h-0">
                {/* Left Panel: Vibes Menu */}
                <div className="w-52 flex-shrink-0 rounded-lg overflow-y-auto bg-stone-900/30 border border-stone-800/50">
                    <VibesMenu
                        seriesId={seriesId}
                        episodeId={episodeId}
                        activeField={activeField}
                        model={clip.model || 'veo-fast'}
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

                {/* Right Panel: Form Fields */}
                <div className="flex-1 bg-stone-900/50 rounded-lg p-4 overflow-y-auto border border-stone-800/50">
                    <div className="grid grid-cols-3 gap-4 h-full">
                        {/* Column 1: Character, Location, Camera */}
                        <div className="flex flex-col gap-3">
                            {/* Character */}
                            <div>
                                <div className="h-7 mb-1 flex items-center">
                                    <label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Character</label>
                                </div>
                                <input
                                    type="text"
                                    value={editValues.character}
                                    onChange={(e) => handleFieldChange('character', e.target.value)}
                                    onFocus={() => setActiveField('character')}
                                    className="modal-field h-8 text-xs leading-4"
                                    placeholder="Character names (comma-separated)"
                                    aria-label="Character field"
                                />
                            </div>

                            {/* Location */}
                            <div>
                                <div className="h-7 mb-1 flex items-center">
                                    <label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Location</label>
                                </div>
                                <input
                                    type="text"
                                    value={editValues.location}
                                    onChange={(e) => handleFieldChange('location', e.target.value)}
                                    onFocus={() => setActiveField('location')}
                                    className="modal-field h-8 text-xs leading-4"
                                    placeholder="Location name"
                                    aria-label="Location field"
                                />
                            </div>

                            {/* Camera */}
                            <div>
                                <div className="h-7 mb-1 flex items-center">
                                    <label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Camera</label>
                                </div>
                                <input
                                    type="text"
                                    value={editValues.camera}
                                    onChange={(e) => handleFieldChange('camera', e.target.value)}
                                    onFocus={() => setActiveField('camera')}
                                    className="modal-field h-8 text-xs leading-4"
                                    placeholder="Camera angle (Low angle, Wide shot)"
                                    aria-label="Camera field"
                                />
                            </div>

                            {/* Movement */}
                            <div>
                                <div className="h-7 mb-1 flex items-center">
                                    <label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Movement</label>
                                </div>
                                <input
                                    type="text"
                                    value={editValues.movement}
                                    onChange={(e) => handleFieldChange('movement', e.target.value)}
                                    onFocus={() => setActiveField('movement')}
                                    className="modal-field h-8 text-xs leading-4"
                                    placeholder="Camera movement (Pan left, Dolly in)"
                                    aria-label="Movement field"
                                />
                            </div>
                        </div>

                        {/* Column 2: Action */}
                        <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between h-7 mb-1">
                                <label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Action</label>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRefreshVibe}
                                        disabled={!lastVibeId}
                                        className="h-6 w-6 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400"
                                        title="Update Vibe"
                                        aria-label="Update vibe"
                                    >
                                        <span className="material-symbols-outlined !text-sm">refresh</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleCreateVibe}
                                        disabled={!editValues.action.trim()}
                                        className="h-6 w-6 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400"
                                        title="Create New Vibe"
                                        aria-label="Create new vibe"
                                    >
                                        <span className="material-symbols-outlined !text-sm">add</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleClearAction}
                                        className="h-6 w-6 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400"
                                        title="Clear Action"
                                        aria-label="Clear action"
                                    >
                                        <span className="material-symbols-outlined !text-sm">clear_all</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleCopyAction}
                                        className="h-6 w-6 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400"
                                        title="Copy to Clipboard"
                                        aria-label="Copy to clipboard"
                                    >
                                        <span className="material-symbols-outlined !text-sm">content_copy</span>
                                    </Button>
                                </div>
                            </div>
                            <textarea
                                value={editValues.action}
                                onChange={(e) => handleFieldChange('action', e.target.value)}
                                onFocus={() => setActiveField('action')}
                                className="modal-field flex-1 py-1.5 resize-none text-xs leading-4"
                                placeholder="Action description / prompt"
                                aria-label="Action field"
                            />
                        </div>

                        {/* Column 3: Dialog + Negate */}
                        <div className="flex flex-col gap-3 h-full">
                            {/* Dialog */}
                            <div className="flex-[3] flex flex-col min-h-0">
                                <div className="h-7 mb-1 flex items-center">
                                    <label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Dialog</label>
                                </div>
                                <textarea
                                    value={editValues.dialog}
                                    onChange={(e) => handleFieldChange('dialog', e.target.value)}
                                    onFocus={() => setActiveField('dialog')}
                                    className="modal-field flex-1 py-1.5 resize-none text-xs leading-4"
                                    placeholder="[CHARACTER]: &quot;Line of dialogue&quot;"
                                    aria-label="Dialog field"
                                />
                            </div>

                            {/* Negate */}
                            <div className="flex-[2] flex flex-col min-h-0">
                                <div className="h-7 mb-1 flex items-center">
                                    <label className="text-xs text-stone-400 uppercase tracking-wider font-medium">Negate</label>
                                </div>
                                <textarea
                                    value={editValues.negativePrompt}
                                    onChange={(e) => handleFieldChange('negativePrompt', e.target.value)}
                                    className="modal-field flex-1 py-1.5 resize-none text-xs leading-4"
                                    placeholder="Negative prompts (what to avoid)"
                                    aria-label="Negate field"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hidden save trigger for header button + Error Display */}
                <button
                    data-save-trigger
                    onClick={handleSave}
                    className="hidden"
                    aria-hidden="true"
                />
                {saveError && (
                    <div className="text-destructive text-sm text-center">
                        {saveError}
                    </div>
                )}
            </div>
        </div>
    );
}

// ========== VibesMenu Component ==========

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

interface VibesMenuProps {
    seriesId: string;
    episodeId?: string;
    activeField: 'character' | 'location' | 'camera' | 'movement' | 'action' | 'dialog' | 'media';
    onSelectVibe: (vibeId: string | null, value: string) => void;
    onStudioAssetClick: (name: string, type: string) => void;
    refreshTrigger?: number; // Prop trigger for live updates
    model: string;
}

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

// Sortable Vibe Item Wrapper
function SortableVibeItem({ vibe, onSelect, onUpdate }: { vibe: Vibe, onSelect: () => void, onUpdate: (v: any) => Promise<void> }) {

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: vibe.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

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
    const { persistMedia, isPersisting } = useMediaPersistence();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );


    // Fetch data based on activeField
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (activeField === 'action') {
                    // Fetch vibes for action field
                    const res = await fetch(`/api/vibes?seriesId=${seriesId}&type=ACTION`);
                    const text = await res.text();
                    if (!res.ok) {
                        throw new Error(`API Error ${res.status}: ${text.slice(0, 100)}`);
                    }
                    try {
                        const data = JSON.parse(text);
                        setVibes(data);
                        setStudioAssets([]);
                    } catch (e) {
                        throw new Error(`Invalid JSON: ${text.slice(0, 100)}`);
                    }
                } else {
                    // Fetch studio assets for other fields
                    const typeMap: Record<string, string> = {
                        character: 'LIB_CHARACTER',
                        location: 'LIB_LOCATION',
                        camera: 'LIB_CAMERA',
                        movement: 'LIB_MOVEMENT', // Maps to MOVEMENT vibes if any, or maybe just ACTION? Actually Vibe has type MOVEMENT.
                        dialog: 'LIB_CHARACTER' // Dialog uses characters for [NAME]: format
                    };

                    if (activeField === 'movement' || activeField === 'camera') {
                        // Fetch vibes for MOVEMENT or CAMERA field
                        const res = await fetch(`/api/vibes?seriesId=${seriesId}&type=${activeField.toUpperCase()}`);
                        const text = await res.text();
                        if (!res.ok) throw new Error(`API Error ${res.status}`);
                        try {
                            const data = JSON.parse(text);
                            setVibes(Array.isArray(data) ? data : []);
                            setStudioAssets([]);
                        } catch (e) {
                            console.error("JSON Parse Error", e);
                            setVibes([]);
                        }
                        setIsLoading(false);
                        return;
                    }

                    const assetType = typeMap[activeField];
                    const res = await fetch(`/api/library?seriesId=${seriesId}&type=${assetType}`);
                    const text = await res.text();
                    if (!res.ok) {
                        throw new Error(`API Error ${res.status}: ${text.slice(0, 100)}`);
                    }
                    try {
                        const data = JSON.parse(text);
                        setStudioAssets(Array.isArray(data) ? data : []);
                        setVibes([]);
                    } catch (e) {
                        throw new Error(`Invalid JSON: ${text.slice(0, 100)}`);
                    }
                }
            } catch (err) {
                console.error('VibesMenu fetch error:', err);
                setError(err instanceof Error ? err.message : 'Failed to load menu items');
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
        <div className="h-full flex flex-col">
            <h3 className="text-xs text-primary uppercase tracking-wider mb-3 font-normal">{getMenuTitle()}</h3>

            {isLoading && (
                <div className="text-stone-500 text-sm">Loading...</div>
            )}

            {error && (
                <div className="text-destructive text-sm">{error}</div>
            )}

            {/* Studio Assets (Characters, Locations, Camera) */}
            {!isLoading && studioAssets.length > 0 && (
                <div className="space-y-1">
                    {studioAssets.map((asset) => (
                        <button
                            key={asset.id}
                            onClick={() => {
                                if (activeField === 'dialog') {
                                    // Insert [NAME]: "" format for dialog
                                    onSelectVibe(null, `[${asset.name}]: ""`);
                                } else {
                                    onStudioAssetClick(asset.name, asset.type.replace('LIB_', ''));
                                }
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-stone-800 text-left transition-colors"
                        >
                            {asset.thumbnailPath && (
                                <img
                                    src={asset.thumbnailPath.split(',')[0].trim()}
                                    alt={asset.name}
                                    className="w-8 h-8 rounded object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            )}
                            <span className="text-[11px] text-white truncate font-light">{asset.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Action Vibes with Drag and Drop */}
            {!isLoading && vibes.length > 0 && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={async (event: DragEndEvent) => {
                        const { active, over } = event;
                        if (active.id !== over?.id) {
                            setVibes((items) => {
                                const oldIndex = items.findIndex((i) => i.id === active.id);
                                const newIndex = items.findIndex((i) => i.id === over?.id);
                                const newItems = arrayMove(items, oldIndex, newIndex);

                                // Update SortOrder properly
                                const updates = newItems.map((item, index) => ({
                                    id: item.id,
                                    sortOrder: index
                                }));

                                // Persist
                                fetch('/api/vibes/reorder', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ items: updates })
                                }).catch(console.error);

                                return newItems;
                            });
                        }
                    }}
                >
                    <SortableContext
                        items={vibes.map(v => v.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-1">
                            {vibes.map((vibe) => (
                                <SortableVibeItem
                                    key={vibe.id}
                                    vibe={vibe}
                                    onSelect={() => onSelectVibe(vibe.id, vibe.prompt)}
                                    // Pass update handler
                                    onUpdate={async (updatedVibe) => {
                                        const res = await fetch('/api/vibes', {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(updatedVibe)
                                        });
                                        if (!res.ok) throw new Error("Failed to update");
                                        setVibes(prev => prev.map(v => v.id === updatedVibe.id ? { ...v, ...updatedVibe } : v));
                                    }}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}



            {!isLoading && studioAssets.length === 0 && vibes.length === 0 && (
                <div className="text-stone-500 text-sm">No items found</div>
            )}
        </div>
    );
}


export { BatchEditContent, VibesMenu };
