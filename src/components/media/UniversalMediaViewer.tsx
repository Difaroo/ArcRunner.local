
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Loader2, Trash2, MinusCircle, Check, X, ChevronLeft, ChevronRight, DownloadCloud, Play, Pause, Maximize2, Minimize2, Volume2, VolumeX, Clapperboard, ImagePlus } from 'lucide-react'; // Added Clapperboard and other video controls
import { Button } from "@/components/ui/button";
import { downloadFile } from '@/lib/download-utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddAsRefDialog } from "@/components/dialogs/viewer/AddAsRefDialog";
import { Clip } from "@/types";
import { useMediaPersistence } from '@/hooks/useMediaPersistence'; // Import hook

// Optimized Types for Universal Usage
export interface UniversalMediaItem {
    id: string;             // Unique ID (Clip ID or Library ID)
    url: string;            // The media URL
    type: 'video' | 'image';
    title: string;

    // Context for Editing
    description?: string;   // For Library Items
    action?: string;        // For Clips

    // Capabilities
    isReference?: boolean; // If true, Minus icon (Unlink) appears instead of Trash (Delete) for context
    canDelete?: boolean;
    deleteIcon?: 'trash' | 'minus'; // Override icon (e.g. use 'minus' for "Clear Result" even if not a reference)
    ownerClipId?: string;  // Context ID for routing unlink (lib-XX for Studio, clipId for Clips)
    episodeId?: string; // Required for Persistence
    isPersisted?: boolean; // Required for UI Feedback (Clapperboard state)
}

interface UniversalMediaViewerProps {
    isOpen: boolean;
    onClose: () => void;

    playlist: UniversalMediaItem[];
    initialIndex: number;

    // Actions
    onUpdate?: (id: string, updates: any) => Promise<void>;
    onDelete?: (id: string) => Promise<void>; // Permanent Delete
    onUnlink?: (url: string, contextId?: string, isResult?: boolean) => Promise<void>; // Unlink from clip


    // Add as Ref Feature
    clips?: Clip[];
    onAddAsRef?: (imageUrl: string, targetClipId: string, action?: 'copy' | 'move', sourceClipId?: string) => Promise<void>;
    // For results: Direct move to own clip's refs (no dialog)
    ownerClipId?: string;  // The clip that owns this result (for direct move)
}

export function UniversalMediaViewer({
    isOpen,
    onClose,
    playlist = [],
    initialIndex = 0,
    onUpdate,
    onDelete,
    onUnlink,

    clips = [],
    onAddAsRef,
    ownerClipId
}: UniversalMediaViewerProps) {

    // --- State ---
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isDirty, setIsDirty] = useState(false);
    const [editValue, setEditValue] = useState("");
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showAddRefDialog, setShowAddRefDialog] = useState(false);
    const { persistMedia, isPersisting } = useMediaPersistence(); // Use hook

    // --- Derived State ---
    // Ensure bounds safety
    const safeIndex = (currentIndex >= 0 && currentIndex < playlist.length) ? currentIndex : 0;
    const currentItem = playlist[safeIndex];

    // Reset on Open/Playlist Change
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex >= 0 ? initialIndex : 0);
        }
    }, [isOpen, initialIndex, playlist.length]);

    // Sync Edit State when Item Changes
    useEffect(() => {
        if (!currentItem) return;
        setEditValue(currentItem.action || currentItem.description || "");
        setIsDirty(false);
    }, [currentItem]);

    // --- Handlers ---

    // Navigation
    const handleNext = () => {
        if (playlist.length <= 1) return;
        setCurrentIndex((prev) => (prev + 1) % playlist.length);
    };

    const handlePrev = () => {
        if (playlist.length <= 1) return;
        setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    };

    // Keyboard Shortcuts
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in text area
            if ((e.target as HTMLElement).tagName === 'TEXTAREA') {
                if (e.key === 'Escape') {
                    // Optional: Escape from textarea focus?
                    // For now, let it propagate or just blur?
                    // Let's allow Esc to close viewer even from text area for speed.
                    (e.target as HTMLElement).blur();
                    e.preventDefault(); // Stop it from writing escape char if any
                    onClose();
                }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSave();
                }
                return;
            }

            switch (e.key) {
                case 'ArrowRight':
                    handleNext();
                    break;
                case 'ArrowLeft':
                    handlePrev();
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
                case 'Delete':
                case 'Backspace':
                    // Prevent back navigation on backspace
                    e.preventDefault();
                    handleDeleteClick();
                    break;
                case 'A': // Cmd+Shift+A: Add Result to Clip
                    if (e.metaKey || e.ctrlKey && e.shiftKey) {
                        e.preventDefault();
                        const itemOwnerClipId = currentItem?.ownerClipId || ownerClipId;
                        if (onAddAsRef && currentItem && itemOwnerClipId) {
                            if (!currentItem.isReference) {
                                // Direct Move
                                onAddAsRef(currentItem.url, itemOwnerClipId, 'move', itemOwnerClipId);
                            } else {
                                // Dialog
                                setShowAddRefDialog(true);
                            }
                        }
                    }
                    break;
                case 'U': // Cmd+Shift+U: Unlink
                    if (e.metaKey || e.ctrlKey && e.shiftKey) {
                        e.preventDefault();
                        if (onUnlink && currentItem) {
                            const contextId = currentItem.ownerClipId;
                            const isResult = !currentItem.isReference;
                            onUnlink(currentItem.url, contextId, isResult);
                            if (currentItem.isReference || currentItem.deleteIcon === 'minus') {
                                onClose();
                            }
                        }
                    }
                    break;
                case 'd': // Legacy Download (Keep d for convenience?) User asked specifically for Cmd+S.
                case 'D':
                    if (currentItem) downloadFile(currentItem.url, currentItem.title);
                    break;
                case 'Enter':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        handleSave();
                    }
                    break;
                case 's':
                    // Cmd+S = Download (User Request)
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        if (currentItem) downloadFile(currentItem.url, currentItem.title);
                    }
                    break;
                case ' ': // Space to Toggle Video
                    e.preventDefault();
                    const video = document.querySelector('video');
                    if (video) {
                        video.paused ? video.play() : video.pause();
                    }
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentIndex, playlist, currentItem, editValue]); // Added dependencies for safety

    // Actions
    const handleSave = async () => {
        if (!currentItem || !onUpdate) return;

        const updates: any = {};
        if (currentItem.action !== undefined) updates.action = editValue;
        if (currentItem.description !== undefined) updates.description = editValue;

        await onUpdate(currentItem.id, updates);
        setIsDirty(false);
    };

    const handleDeleteClick = async () => {
        if (!currentItem) return;

        // UNLINK: For reference images or results with 'minus' icon
        if (currentItem.isReference && onUnlink) {
            const contextId = currentItem.ownerClipId;
            const isResult = false; // References are never results
            console.log('[UniversalViewer] Unlinking reference:', { url: currentItem.url, contextId, isResult });
            await onUnlink(currentItem.url, contextId, isResult);
            onClose(); // Close viewer after unlinking
            return;
        }

        // CLEAR RESULT: Low-risk action with 'minus' icon
        if (currentItem.deleteIcon === 'minus' && onDelete) {
            await onDelete(currentItem.id);
            onClose();
            return;
        }

        // DELETE: High-risk permanent deletion - show confirmation dialog
        if (onDelete) {
            setShowDeleteDialog(true);
        }
    };

    const confirmDelete = async () => {
        if (currentItem && onDelete) {
            await onDelete(currentItem.id);
            setShowDeleteDialog(false);
            onClose(); // Close viewer after deletion
        }
    };

    // --- Render ---
    if (!isOpen || !currentItem) return null;

    const isVideo = currentItem.type === 'video';
    const isImage = currentItem.type === 'image';

    // Portal to Body to escape z-index / transform traps
    const content = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="relative w-full max-w-6xl flex flex-col gap-4 max-h-[90vh] h-full" onClick={e => e.stopPropagation()}>

                {/* 1. Main Media Area */}
                {/* Fixed Aspect Ratio 16:9 Container */}
                <div className="relative w-full aspect-video bg-black/50 border border-zinc-800 shadow-2xl rounded-lg overflow-hidden flex items-center justify-center group/player">

                    {/* Top Controls Overlay - Always Visible */}
                    <div className="absolute top-0 right-0 p-4 flex gap-2 z-50 bg-gradient-to-b from-black/60 to-transparent">
                        {/* Add as Ref Image - Different behavior for Results vs Refs */}
                        {/* ENABLED FOR BOTH IMAGES AND VIDEOS */}
                        {(isImage || isVideo) && onAddAsRef && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Determine ownerClipId: Prefer item-level (from rich playlist), fallback to prop
                                                // @ts-ignore - dynamic prop from polymorphic playlist
                                                const itemOwnerClipId = currentItem.ownerClipId || ownerClipId;

                                                // Immediate Sideload: If this is a Result (not ref) belonging to a clip
                                                if (itemOwnerClipId && !currentItem.isReference && onAddAsRef) {
                                                    // "Sideload" = Move Result to Refs of same clip
                                                    onAddAsRef(currentItem.url, itemOwnerClipId, 'move', itemOwnerClipId);
                                                } else {
                                                    // Otherwise (Copying, or moving from elsewhere), show dialog
                                                    setShowAddRefDialog(true);
                                                }
                                            }}
                                        >
                                            <ImagePlus className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {currentItem.isReference ? 'Copy/Move to clip' : 'Add Result to Clip (⌘⇧A)'}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {/* Unlink (Minus) - For both Refs AND Results with 'minus' icon */}
                        {onUnlink && (currentItem.isReference || currentItem.deleteIcon === 'minus') && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // UNIFIED: Both refs and results call onUnlink
                                                // Pass item type so handler knows which field to clear
                                                const contextId = currentItem.ownerClipId;
                                                const isResult = !currentItem.isReference;
                                                console.log('[UniversalViewer Unlink] contextId:', contextId, 'isResult:', isResult, 'url:', currentItem.url);
                                                onUnlink(currentItem.url, contextId, isResult);
                                            }}
                                        >
                                            <MinusCircle className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {currentItem.isReference ? 'Unlink Reference (⌘⇧U)' : 'Unlink Result (⌘⇧U)'}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {/* Delete (Trash) - Only for Root Assets without 'minus' override */}
                        {onDelete && !currentItem.isReference && currentItem.deleteIcon !== 'minus' && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10" onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}>
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete Permanently</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                                {currentItem.title}
                            </p>
                            {/* Persistence / Download Action */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-8 w-8 ${currentItem.isPersisted ? 'text-green-500 hover:text-green-400' : 'text-zinc-400 hover:text-white'}`}
                                            disabled={isPersisting}
                                            onClick={async (e) => {
                                                e.stopPropagation();

                                                // 1. VIDEOS with Episode Context -> Persist
                                                if (isVideo && currentItem.episodeId && currentItem.ownerClipId) {
                                                    try {
                                                        const res = await persistMedia({
                                                            clipId: currentItem.ownerClipId, // Use context ID (Clip ID)
                                                            episodeId: currentItem.episodeId
                                                        });

                                                        // Optimistic UI Update (if success)
                                                        if (res && res.success) {
                                                            console.log('Persist Success', res);
                                                        }
                                                    } catch (err) {
                                                        console.error('[UniversalMediaViewer] Persist Error:', err);
                                                    }
                                                    return;
                                                } else {
                                                    console.warn('[UniversalMediaViewer] Missing IDs for persistence:', { isVideo, episodeId: currentItem.episodeId, ownerClipId: currentItem.ownerClipId });
                                                }

                                                // 2. Fallback / Images -> Standard Download
                                                try {
                                                    await downloadFile(currentItem.url, currentItem.title);
                                                } catch (err) {
                                                    console.error("Download fail", err);
                                                }
                                            }}
                                        >
                                            {isPersisting ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                /* Logic: 
                                                   - Persisted Video -> Clapperboard (Filled/Closed)
                                                   - Unpersisted Video -> Clapperboard (Open)
                                                   - Image -> DownloadCloud
                                                */
                                                isVideo && currentItem.episodeId ? (
                                                    currentItem.isPersisted ? (
                                                        <Clapperboard className="h-4 w-4 fill-current" />
                                                    ) : (
                                                        <Clapperboard className="h-4 w-4" />
                                                    )
                                                ) : (
                                                    <DownloadCloud className="h-4 w-4" />
                                                )
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{isVideo && currentItem.episodeId
                                            ? (currentItem.isPersisted ? 'Saved to Episode Folder' : 'Save to Episode Folder')
                                            : 'Download File'}
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>

                    {/* Delete (Trash) - Only for Root Assets without 'minus' override */}
                    {onDelete && !currentItem.isReference && currentItem.deleteIcon !== 'minus' && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10" onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}>
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Permanently</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>

                {/* Close */}
                <div className="absolute top-4 right-4 z-50">
                    <Button variant="ghost" size="icon" className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                        <X className="h-6 w-6" />
                    </Button>
                </div>

                {/* Top Left: Title Info - Transparent BG */}
                <div className="absolute top-4 left-4 z-50 pointer-events-none">
                    <h3 className="text-white/90 font-medium text-lg drop-shadow-md px-3 py-1 rounded bg-black/20 backdrop-blur-sm">
                        {currentItem.title}
                    </h3>
                </div>

                {/* Navigation Arrows */}
                {playlist.length > 1 && (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-orange-500 hover:bg-black/80 hover:text-orange-400 transition-all z-40">
                            <ChevronLeft className="h-8 w-8" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-orange-500 hover:bg-black/80 hover:text-orange-400 transition-all z-40">
                            <ChevronRight className="h-8 w-8" />
                        </button>
                    </>
                )}

                {/* Media Content - Stop Propagation on Click to prevent Close */}
                <div className="w-full h-full flex items-center justify-center p-8" onClick={(e) => e.stopPropagation()}>
                    {isVideo ? (
                        <video
                            src={currentItem.url}
                            controls
                            autoPlay
                            className="max-w-full max-h-full object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <img
                            src={currentItem.url}
                            alt={currentItem.title}
                            className="max-w-full max-h-full object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </div>



                {/* 2. Contextual Edit Area (Bottom) */}
                {onUpdate && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50 pointer-events-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-4 bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 backdrop-blur-md shadow-xl">
                            <div className="flex-1">
                                <textarea
                                    value={editValue}
                                    onChange={(e) => { setEditValue(e.target.value); setIsDirty(true); }}
                                    placeholder={currentItem.action !== undefined ? "Edit Action..." : "Edit Description..."}
                                    className="w-full bg-transparent text-zinc-200 text-sm focus:outline-none resize-none h-16 placeholder:text-zinc-600 font-light"
                                />
                            </div>
                            <div className="flex flex-col justify-end">
                                <Button
                                    size="icon"
                                    variant={isDirty ? "default" : "ghost"}
                                    className={`h-10 w-10 ${isDirty ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'text-zinc-600'}`}
                                    onClick={handleSave}
                                    disabled={!isDirty}
                                    title="Save (Cmd+Enter)"
                                >
                                    <Check className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Permanently?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            This will permanently delete the file and record. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white border-none">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Add as Ref Image Dialog - Only for ref images */}
            <AddAsRefDialog
                open={showAddRefDialog}
                onOpenChange={setShowAddRefDialog}
                imageUrl={currentItem?.url || ''}
                clips={clips}
                onCopy={async (targetClipId) => {
                    if (onAddAsRef && currentItem) {
                        await onAddAsRef(currentItem.url, targetClipId, 'copy');
                    }
                }}
                onMove={async (targetClipId) => {
                    if (onAddAsRef && currentItem) {
                        await onAddAsRef(currentItem.url, targetClipId, 'move');
                    }
                }}
            />
        </div >
    );

    // Dynamic import for client-side portal? 
    // Usually standard import is fine, but need to check if document exists (SSR safety)
    if (typeof document === 'undefined') return null;

    // We need to import createPortal
    return ReactDOM.createPortal(content, document.body);
}
