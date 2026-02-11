'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

import { Clip } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { VibeItem } from './VibeItem';

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
    const [activeField, setActiveField] = useState<'character' | 'location' | 'camera' | 'action' | 'dialog' | 'media'>('character');
    const [lastVibeId, setLastVibeId] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Issue #1 FIX: Sync editValues when clip changes
    const [editValues, setEditValues] = useState({
        character: clip.character || '',
        location: clip.location || '',
        camera: clip.camera || '',
        action: clip.action || '',
        dialog: clip.dialog || '',
        negativePrompt: clip.negativePrompt || '',
        refImageUrls: clip.refImageUrls || ''
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
            action: clip.action || '',
            dialog: clip.dialog || '',
            negativePrompt: clip.negativePrompt || '',
            refImageUrls: clip.refImageUrls || ''
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
                action: editValues.action,
                dialog: editValues.dialog,
                refImageUrls: editValues.refImageUrls,
                negativePrompt: editValues.negativePrompt, // Ensure negativePrompt is saved
                status: status // Persist status
                // Issue #2: movement would go here when schema supports it
            });
        } catch (error) {
            setSaveError('Failed to save changes');
        }
    };

    return (
        <div className="h-full flex gap-4">
            {/* Left Panel: Vibes Menu */}
            <div className="w-52 flex-shrink-0 rounded-lg overflow-y-auto">
                <VibesMenu
                    seriesId={seriesId}
                    episodeId={episodeId}
                    activeField={activeField}
                    onSelectVibe={(vibeId, value) => {
                        if (activeField === 'action') {
                            handleVibeSelect(vibeId, value, 'action');
                        } else if (activeField === 'dialog') {
                            // Insert character dialog format
                            handleFieldChange('dialog', editValues.dialog + (editValues.dialog ? '\n' : '') + value);
                        }
                    }}
                    onStudioAssetClick={(name, type) => {
                        if (type === 'CHARACTER') {
                            // Toggle character in comma-sep list
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
                    onMediaClick={(item: any, isOptionClick: boolean) => {
                        if (item.type === 'IMAGE') {
                            // Append to refImageUrls
                            const existing = editValues.refImageUrls ? editValues.refImageUrls.split(',').map(s => s.trim()) : [];
                            if (!existing.includes(item.url)) {
                                handleFieldChange('refImageUrls', [...existing, item.url].join(', '));
                            }
                        } else if (item.type === 'VIDEO') {
                            // Set Result URL via onSave (immediate update for result)
                            // Or just update local state if we had it. But Clip interface has resultUrl. 
                            // We should PROBABLY save immediately for resultUrl as it's not in the 3-col form? 
                            // Wait, resultUrl is NOT in the form. So we must call onSave.
                            onSave({ resultUrl: item.url });
                        }

                        if (isOptionClick) {
                            onNavigate('down');
                        }
                    }}
                />
            </div>

            {/* Right Panel: Form + Preview */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                {/* Asset Preview Strip */}
                <AssetPreviewStrip
                    characters={editValues.character}
                    location={editValues.location}
                    refImageUrls={editValues.refImageUrls}
                    resultUrl={clip.resultUrl}
                    mediaResults={clip.mediaResults} // Pass history
                    seriesId={seriesId}
                    onClick={() => setActiveField('media')}
                />

                {/* Form Fields - 3 Column Layout */}
                <div className="flex-1 bg-stone-900 rounded-lg p-4 overflow-y-auto">
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
                                    placeholder="Camera angle/movement"
                                    aria-label="Camera field"
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
    activeField: 'character' | 'location' | 'camera' | 'action' | 'dialog' | 'media';
    onSelectVibe: (vibeId: string | null, value: string) => void;
    onStudioAssetClick: (name: string, type: string) => void;
    onMediaClick?: (item: any, isOptionClick: boolean) => void;
    refreshTrigger?: number; // Prop trigger for live updates
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

function VibesMenu({ seriesId, episodeId, activeField, onSelectVibe, onStudioAssetClick, onMediaClick, refreshTrigger }: VibesMenuProps) {
    const [studioAssets, setStudioAssets] = useState<StudioAsset[]>([]);
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [vibes, setVibes] = useState<Vibe[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                } else if (activeField === 'media') {
                    // Fetch Media items
                    console.log('[VibesMenu] Fetching media. EpisodeId:', episodeId);
                    if (!episodeId) {
                        console.warn('[VibesMenu] Missing episodeId');
                        return;
                    }
                    const res = await fetch(`/api/media?episodeId=${episodeId}`);
                    const text = await res.text();
                    if (!res.ok) throw new Error(`API Error ${res.status}`);
                    try {
                        const data = JSON.parse(text);
                        setMediaItems(Array.isArray(data) ? data : []);
                        setStudioAssets([]);
                        setVibes([]);
                    } catch (e) {
                        throw new Error('Invalid JSON');
                    }
                } else {
                    // Fetch studio assets for other fields
                    const typeMap: Record<string, string> = {
                        character: 'LIB_CHARACTER',
                        location: 'LIB_LOCATION',
                        camera: 'LIB_CAMERA',
                        dialog: 'LIB_CHARACTER' // Dialog uses characters for [NAME]: format
                    };
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

            {/* Media Items */}
            {!isLoading && mediaItems.length > 0 && (
                <div className="grid grid-cols-2 gap-2 p-1">
                    {mediaItems.map((item) => (
                        <div
                            key={item.id}
                            className="relative aspect-video bg-stone-800 rounded overflow-hidden cursor-pointer group border border-transparent hover:border-white/20"
                            onClick={(e) => onMediaClick?.(item, e.altKey)}
                        >
                            {/* Thumbnail or Video Preview */}
                            {(item.thumbnailPath || (item.type === 'IMAGE' && item.url)) ? (
                                <img
                                    src={item.thumbnailPath || item.url}
                                    className="w-full h-full object-cover"
                                    alt="Media"
                                />
                            ) : (item.type === 'VIDEO' && item.url) ? (
                                <video
                                    src={item.url}
                                    className="w-full h-full object-cover"
                                    muted
                                    onMouseOver={e => e.currentTarget.play()}
                                    onMouseOut={e => {
                                        e.currentTarget.pause();
                                        e.currentTarget.currentTime = 0;
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-stone-500">
                                    {item.type}
                                </div>
                            )}

                            {/* Type Icon Badge */}
                            <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/60 rounded flex items-center justify-center">
                                <span className="material-symbols-outlined !text-[14px] text-white">
                                    {item.type === 'VIDEO' ? 'play_arrow' : item.type === 'IMAGE' ? 'image' : 'help'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!isLoading && studioAssets.length === 0 && vibes.length === 0 && mediaItems.length === 0 && (
                <div className="text-stone-500 text-sm">No items found</div>
            )}
        </div>
    );
}

// ========== AssetPreviewStrip Component ==========

interface AssetPreviewStripProps {
    characters: string;
    location: string;
    refImageUrls?: string;
    resultUrl?: string;
    mediaResults?: any[]; // Allow passing full history
    seriesId: string;
    onClick?: () => void;
}

interface AssetThumbnail {
    name: string;
    thumbnailPath?: string;
    type: string;
}

function AssetPreviewStrip({ characters, location, refImageUrls, resultUrl, mediaResults, seriesId, onClick }: AssetPreviewStripProps) {
    const [assetThumbnails, setAssetThumbnails] = useState<AssetThumbnail[]>([]);
    const [locationThumbnail, setLocationThumbnail] = useState<string | null>(null);

    const characterNames = characters.split(',').map(c => c.trim()).filter(Boolean);
    const refImages = refImageUrls ? refImageUrls.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Filter Previous Results (exclude current resultUrl if present)
    const previousResults = (mediaResults || []).filter(m => m.url !== resultUrl);

    // Fetch thumbnails when characters/location change
    useEffect(() => {
        const fetchThumbnails = async () => {
            if (!seriesId) return;

            try {
                // Fetch character thumbnails
                if (characterNames.length > 0) {
                    const res = await fetch(`/api/library?seriesId=${seriesId}&type=LIB_CHARACTER`);
                    if (res.ok) {
                        const items = await res.json();
                        const matched = items.filter((item: AssetThumbnail) =>
                            characterNames.includes(item.name)
                        );
                        setAssetThumbnails(matched);
                    }
                }

                // Fetch location thumbnail
                if (location) {
                    const res = await fetch(`/api/library?seriesId=${seriesId}&type=LIB_LOCATION`);
                    if (res.ok) {
                        const items = await res.json();
                        const matched = items.find((item: AssetThumbnail) =>
                            item.name === location
                        );
                        setLocationThumbnail(matched?.thumbnailPath || null);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch asset thumbnails:', error);
            }
        };

        fetchThumbnails();
    }, [characterNames.join(','), location, seriesId]);

    return (
        <div className="h-64 flex gap-4">
            {/* LEFT: Scrollable Asset Scroller (Grey Panel) */}
            <div
                className="flex-1 bg-stone-900 rounded-lg p-3 flex gap-2.5 overflow-x-auto items-center cursor-pointer hover:bg-stone-800/80 transition-colors min-w-0 overscroll-x-contain touch-pan-x" // Added overscroll-x-contain and touch-pan-x
                onClick={onClick}
            >
                {/* Studio Assets: Location */}
                {location && (
                    <div
                        className="h-full aspect-video bg-stone-800 rounded border border-white/10 overflow-hidden relative group shrink-0"
                        title={location}
                    >
                        {locationThumbnail ? (
                            <img
                                src={locationThumbnail.split(',')[0].trim()}
                                alt={location}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-xs text-stone-500 text-center px-1">{location}</span>
                            </div>
                        )}

                        {/* Overlay Gradient (Bottom) */}
                        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />

                        {/* Label (Bottom Left) */}
                        <div className="absolute bottom-2 left-1 right-5 text-[10px] text-stone-300 truncate text-left font-medium drop-shadow-md">
                            {location}
                        </div>

                        {/* Icon (Bottom Right) */}
                        <div className="absolute bottom-1 right-1">
                            <span className="material-symbols-outlined text-white/90 !text-[12px] block drop-shadow-md">
                                location_on
                            </span>
                        </div>
                    </div>
                )}

                {/* Studio Assets: Characters */}
                {characterNames.map((name, idx) => {
                    const asset = assetThumbnails.find(a => a.name === name);
                    return (
                        <div
                            key={idx}
                            className="h-full aspect-[3/4] bg-stone-800 rounded border border-white/10 overflow-hidden relative group shrink-0"
                            title={name}
                        >
                            {asset?.thumbnailPath ? (
                                <img
                                    src={asset.thumbnailPath.split(',')[0].trim()}
                                    alt={name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-xs text-stone-500 text-center px-1">{name}</span>
                                </div>
                            )}

                            {/* Overlay Gradient (Bottom) */}
                            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />

                            {/* Label (Bottom Left) */}
                            <div className="absolute bottom-1 left-1 right-5 text-[10px] text-stone-300 truncate text-left font-medium drop-shadow-md">
                                {name}
                            </div>

                            {/* Icon (Bottom Right) */}
                            <div className="absolute bottom-1 right-1">
                                <span className="material-symbols-outlined text-white/90 !text-[12px] block drop-shadow-md">
                                    person
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Reference Images */}
                {refImages.map((url, idx) => (
                    <div
                        key={`ref-${idx}`}
                        className="h-full aspect-video bg-stone-800 rounded border border-white/10 overflow-hidden relative group shrink-0"
                        title={`Reference Image ${idx + 1}`}
                    >
                        <img
                            src={url}
                            alt={`Ref ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />

                        {/* Overlay Gradient (Bottom) */}
                        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />

                        {/* Label (Bottom Left) */}
                        <div className="absolute bottom-1 left-1 right-5 text-[10px] text-stone-300 truncate text-left font-medium drop-shadow-md">
                            Reference {idx + 1}
                        </div>

                        {/* Icon (Bottom Right) */}
                        <div className="absolute bottom-1 right-1">
                            <span
                                className="material-symbols-outlined text-white/90 !text-[12px] block drop-shadow-md"
                                style={{ fontSize: '12px' }}
                            >
                                image
                            </span>
                        </div>
                    </div>
                ))}

                {/* Previous Results (History) */}
                {previousResults.map((item, idx) => (
                    <div
                        key={`hist-${idx}`}
                        className="h-full aspect-video bg-stone-800 rounded border border-white/10 overflow-hidden relative group shrink-0 opacity-80 hover:opacity-100 transition-opacity"
                        title={`Previous Result: ${item.type}`}
                    >
                        {(item.thumbnailPath || (item.type === 'IMAGE' && item.url)) ? (
                            <img
                                src={item.thumbnailPath || item.url}
                                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all"
                                alt="Previous Result"
                            />
                        ) : (item.type === 'VIDEO' && item.url) ? (
                            <video
                                src={item.url}
                                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all"
                                muted
                                onMouseOver={e => e.currentTarget.play()}
                                onMouseOut={e => {
                                    e.currentTarget.pause();
                                    e.currentTarget.currentTime = 0;
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-stone-500">
                                {item.type}
                            </div>
                        )}

                        {/* Icon (Bottom Right) */}
                        <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/60 rounded flex items-center justify-center">
                            <span className="material-symbols-outlined !text-[14px] text-white">
                                {item.type === 'VIDEO' ? 'play_arrow' : 'auto_awesome'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* RIGHT: Latest Result (Floating/Transparent) */}
            <div className="flex-shrink-0 h-full">
                {resultUrl ? (
                    <div className="h-full aspect-video rounded border-2 border-primary overflow-hidden shadow-xl">
                        {resultUrl.includes('.mp4') || resultUrl.includes('.webm') || resultUrl.includes('.mov') ? (
                            <video
                                src={resultUrl}
                                className="w-full h-full object-cover"
                                controls
                                playsInline
                                preload="metadata"
                            />
                        ) : (
                            <img
                                src={resultUrl}
                                alt="Latest Result"
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        )}
                    </div>
                ) : (
                    <div className="h-full aspect-video bg-stone-950/50 rounded border border-dashed border-stone-800 flex items-center justify-center">
                        <span className="text-xs text-stone-600">No Result</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export { BatchEditContent, VibesMenu, AssetPreviewStrip };
