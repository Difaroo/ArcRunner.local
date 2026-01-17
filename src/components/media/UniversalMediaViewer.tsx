
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Loader2, Trash2, MinusCircle, Check, X, ChevronLeft, ChevronRight, Save, Download, ImagePlus } from "lucide-react";
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
}

interface UniversalMediaViewerProps {
    isOpen: boolean;
    onClose: () => void;

    playlist: UniversalMediaItem[];
    initialIndex: number;

    // Actions
    onUpdate?: (id: string, updates: any) => Promise<void>;
    onDelete?: (id: string) => Promise<void>; // Permanent Delete
    onUnlink?: (url: string) => Promise<void>; // Remove from list


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
                case 'd':
                case 'D':
                    if (currentItem) downloadFile(currentItem.url, currentItem.title);
                    break;
                case 'Enter':
                case 's': // Cmd+S also
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        handleSave();
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
        // If it's a reference image (Unlink) OR an explicit 'minus' icon (Clear), we do it immediately (Low Risk)
        if ((currentItem.isReference && onUnlink)) {
            onUnlink(currentItem.url);
        } else if (currentItem.deleteIcon === 'minus' && onDelete) {
            // Low risk 'Clear' action - No dialog needed
            await onDelete(currentItem.id);
            onClose();
        } else if (onDelete) {
            // If it's a root asset (Delete), we show Dialog (High Risk)
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
                        {isImage && onAddAsRef && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-zinc-400 hover:text-white"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                const ownerClipId = (currentItem as any).ownerClipId;

                                                if (ownerClipId && currentItem.isReference) {
                                                    // Already a reference
                                                    setShowAddRefDialog(true);
                                                } else if (ownerClipId) {
                                                    // Result Image: Direct move to own clip's refs
                                                    await onAddAsRef(currentItem.url, ownerClipId, 'move', ownerClipId);
                                                } else {
                                                    // Fallback: Show dialog
                                                    setShowAddRefDialog(true);
                                                }
                                            }}
                                        >
                                            <ImagePlus className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {currentItem.isReference ? 'Copy/Move to clip' : 'Add as ref image'}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {/* Unlink (Minus) - Only for Refs OR if explicit 'minus' icon requested */}
                        {((onUnlink && currentItem.isReference) || (onDelete && currentItem.deleteIcon === 'minus')) && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // If it's a ref with unlinker, unlink. Otherwise, if it has delete handler (even if minus icon), call delete.
                                                if (onUnlink && currentItem.isReference) {
                                                    onUnlink(currentItem.url);
                                                } else {
                                                    handleDeleteClick();
                                                }
                                            }}
                                        >
                                            <MinusCircle className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {currentItem.isReference ? 'Unlink Reference' : 'Clear/Remove Item'}
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

                        {/* Download */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10" onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                            await downloadFile(currentItem.url, currentItem.title);
                                        } catch (err) {
                                            console.error("Download fail", err);
                                        }
                                    }}>
                                        <Download className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Download</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Close */}
                        <Button variant="ghost" size="icon" className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                            <X className="h-6 w-6" />
                        </Button>
                    </div>

                    {/* Bottom Left: Title Info - Transparent BG */}
                    <div className="absolute bottom-4 left-4 z-50 pointer-events-none">
                        <h3 className="text-white/90 font-medium text-lg drop-shadow-md px-3 py-1 rounded">
                            {currentItem.title}
                        </h3>
                    </div>

                    {/* Navigation Arrows */}
                    {playlist.length > 1 && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="absolute left-4 p-2 rounded-full bg-black/40 text-orange-500 hover:bg-black/80 hover:text-orange-400 transition-all z-40">
                                <ChevronLeft className="h-8 w-8" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-4 p-2 rounded-full bg-black/40 text-orange-500 hover:bg-black/80 hover:text-orange-400 transition-all z-40">
                                <ChevronRight className="h-8 w-8" />
                            </button>
                        </>
                    )}

                    {/* Media Content - Stop Propagation on Click to prevent Close */}
                    {isVideo ? (
                        <video
                            src={currentItem.url}
                            controls
                            autoPlay
                            className="w-full h-full object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <img
                            src={currentItem.url}
                            alt={currentItem.title}
                            className="w-full h-full object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </div>

                {/* 2. Contextual Edit Area (Bottom) */}
                {onUpdate && (
                    <div className="flex gap-4 bg-zinc-900/90 p-3 rounded-lg border border-zinc-800 backdrop-blur-md">
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
