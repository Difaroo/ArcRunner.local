
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Loader2, MinusCircle, Check, X, ChevronLeft, ChevronRight, DownloadCloud, Play, Pause, Maximize2, Minimize2, Volume2, VolumeX, Clapperboard } from 'lucide-react'; // Added Clapperboard and other video controls
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
    const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
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
                        if (onAddAsRef && currentItem) {
                            if (ownerClipId && !currentItem.isReference) {
                                // Direct Move to the explicitly specified context clip
                                onAddAsRef(currentItem.url, ownerClipId, 'move', currentItem.ownerClipId);
                            } else {
                                // Dialog required when no explicit destination is set (e.g. Media Gallery) or for references
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

    const confirmUnlink = async () => {
        if (currentItem && onUnlink) {
            const contextId = currentItem.ownerClipId;
            const isResult = !currentItem.isReference;
            await onUnlink(currentItem.url, contextId, isResult);
            setShowUnlinkDialog(false);
            // Optionally auto-close if viewing a result that is now unlinked from the open clip?
            // Rely on the list mutation at the parent level instead.
        }
    };

    // --- Render ---
    if (!isOpen || !currentItem) return null;

    const isVideo = currentItem.type === 'video';
    const isImage = currentItem.type === 'image';

    // Portal to Body to escape z-index / transform traps
    const content = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            {/* Unified BEM-Style Modal Container */}
            {/* max-w calculates 16:9 hugging for 90vh minus ~160px of header/footer space */}
            <div className="w-full h-full max-h-[90vh] max-w-[min(90vw,calc((90vh-160px)*16/9))] bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>

                {/* 1. Header Bar (Top) - Integrated, No Border Radius, No Transparent Background Box */}
                <div className="shrink-0 flex items-center justify-between px-4 py-3">
                    <div className="flex items-center">
                        {/* Decorative BEM Traffic Lights */}
                        <div className="flex items-center gap-1.5 mr-3">
                            <div className="w-3 h-3 rounded-full bg-red-500 opacity-30" />
                            <div className="w-3 h-3 rounded-full bg-orange-500 opacity-30" />
                            <div className="w-3 h-3 rounded-full bg-green-500 opacity-50" />
                        </div>
                        <h3 className="text-zinc-200 font-normal text-lg">
                            {currentItem.title}
                        </h3>
                    </div>

                    <div className="flex items-center gap-2 scale-90 origin-right">
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
                                                if (ownerClipId && !currentItem.isReference && onAddAsRef) {
                                                    // Direct Move to the explicitly specified context clip
                                                    onAddAsRef(currentItem.url, ownerClipId, 'move', currentItem.ownerClipId);
                                                } else {
                                                    // Dialog required when no explicit destination is set (e.g. Media Gallery)
                                                    setShowAddRefDialog(true);
                                                }
                                            }}
                                        >
                                            <span className="material-symbols-outlined !text-[20px] ml-0.5">arrow_forward</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {currentItem.isReference ? 'Copy/Move to MIS slot' : 'Send to Input Slot (⌘⇧A)'}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {/* Unlink (Minus) */}
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
                                                setShowUnlinkDialog(true);
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


                        {/* Persistence / Download Action */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-9 w-9 ${currentItem.isPersisted ? 'text-green-500 hover:text-green-400' : 'text-zinc-400 hover:text-white'}`}
                                        disabled={isPersisting}
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (isVideo && currentItem.episodeId && currentItem.ownerClipId) {
                                                try {
                                                    await persistMedia({
                                                        clipId: currentItem.ownerClipId,
                                                        episodeId: currentItem.episodeId
                                                    });
                                                } catch (err) {
                                                    console.error('[UniversalMediaViewer] Persist Error:', err);
                                                }
                                                return;
                                            }
                                            try {
                                                await downloadFile(currentItem.url, currentItem.title);
                                            } catch (err) {
                                                console.error("Download fail", err);
                                            }
                                        }}
                                    >
                                        {isPersisting ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            isVideo && currentItem.episodeId ? (
                                                currentItem.isPersisted ? (
                                                    <Clapperboard className="h-5 w-5 fill-current" />
                                                ) : (
                                                    <Clapperboard className="h-5 w-5" />
                                                )
                                            ) : (
                                                <DownloadCloud className="h-5 w-5" />
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

                        {/* Close Toolbar Separator */}
                        <div className="w-px h-6 bg-zinc-700 mx-2"></div>

                        {/* Close */}
                        <Button variant="ghost" size="icon" className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                </div>

                {/* 2. Media Frame (Middle) */}
                <div className="flex-1 min-h-0 relative bg-black/95 border-b border-zinc-800 overflow-hidden flex items-center justify-center group/player">

                    {/* Navigation Arrows */}
                    {playlist.length > 1 && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="absolute left-6 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-orange-500 hover:bg-black/80 hover:text-orange-400 transition-all z-40 opacity-0 group-hover/player:opacity-100 border border-zinc-800/50">
                                <ChevronLeft className="h-8 w-8" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-orange-500 hover:bg-black/80 hover:text-orange-400 transition-all z-40 opacity-0 group-hover/player:opacity-100 border border-zinc-800/50">
                                <ChevronRight className="h-8 w-8" />
                            </button>
                        </>
                    )}

                    {/* Media Content */}
                    <div className="w-full h-full flex items-center justify-center object-contain" onClick={(e) => e.stopPropagation()}>
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
                </div>

                {/* 3. Contextual Edit Area (Bottom) - Anchor to bottom inside modal */}
                {onUpdate && (
                    <div className="shrink-0 w-full p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-row gap-4 max-w-4xl mx-auto items-start h-20">
                            <div className="h-full flex items-start justify-end pt-2 w-24 shrink-0">
                                <label className="text-xs text-stone-400 uppercase tracking-wider font-medium px-1">
                                    {currentItem.action !== undefined ? "Action" : "Description"}
                                </label>
                            </div>
                            <div className="flex gap-4 flex-1 h-full">
                                <textarea
                                    value={editValue}
                                    onChange={(e) => { setEditValue(e.target.value); setIsDirty(true); }}
                                    placeholder={currentItem.action !== undefined ? "Enter Action prompt..." : "Enter Description..."}
                                    className="modal-field flex-1 resize-none h-full py-2 text-sm leading-5"
                                />
                                <div className="flex flex-col justify-end">
                                    <Button
                                        size="icon"
                                        variant={isDirty ? "default" : "outline"}
                                        className={`h-10 w-10 ${isDirty ? 'bg-orange-600 hover:bg-orange-700 text-white border-transparent' : 'text-zinc-600 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300'}`}
                                        onClick={handleSave}
                                        disabled={!isDirty}
                                        title="Save (Cmd+Enter)"
                                    >
                                        <Check className="h-5 w-5" />
                                    </Button>
                                </div>
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

            {/* Unlink Confirmation Dialog */}
            <AlertDialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unlink Media?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            {currentItem?.isReference
                                ? "This will detach the active reference and return the Asset back to the broader Episode Pool."
                                : "This will detach the generated media from this slot and return it to the broader Episode Pool."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmUnlink} className="bg-orange-600 hover:bg-orange-700 text-white border-none">Unlink</AlertDialogAction>
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
