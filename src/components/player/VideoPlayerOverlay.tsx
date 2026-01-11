
import React, { useEffect, useState } from 'react';
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFile } from '@/lib/download-utils';
import { Clip } from '@/types';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface VideoPlayerOverlayProps {
    url: string | null;
    onClose: () => void;
    playlist?: string[];
    initialIndex?: number;
    clips?: Clip[]; // To find model/type info
    archiveMedia: (url: string | null) => Promise<void>;
    isArchiving: boolean;
    // Edit Support
    libraryItems?: any[];
    onUpdateClip?: (id: string, updates: Partial<Clip>) => Promise<void>;
    onUpdateLibrary?: (id: string, updates: any) => Promise<void>;
}

export function VideoPlayerOverlay({
    url,
    onClose,
    playlist = [],
    initialIndex = -1,
    clips = [],
    archiveMedia,
    isArchiving,
    libraryItems,
    onUpdateClip,
    onUpdateLibrary
}: VideoPlayerOverlayProps) {
    const [currentUrl, setCurrentUrl] = useState<string | null>(url);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    // Sync prop changes
    useEffect(() => {
        setCurrentUrl(url);
        setCurrentIndex(initialIndex);
    }, [url, initialIndex]);
    // Navigation
    const handleNext = () => {
        if (playlist.length <= 1) return;
        setCurrentIndex((prev) => (prev + 1) % playlist.length);
        setCurrentUrl(playlist[(currentIndex + 1) % playlist.length]);
    };

    const handlePrev = () => {
        if (playlist.length <= 1) return;
        const nextIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        setCurrentIndex(nextIndex);
        setCurrentUrl(playlist[nextIndex]);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, playlist, onClose]);

    // Determine media type and item
    // Resilience: Normalize URLs (decode) to ensure matches despite encoding differences
    const normalize = (u: string | null | undefined) => u ? decodeURIComponent(u).trim() : '';
    const targetUrl = normalize(currentUrl);

    // Finding Loop Logic:
    // 1. Clips: Check resultUrl (split by comma)
    // 2. Library: Check refImageUrl (split by comma)
    const playingClip = clips.find(c => {
        const urls = (c.resultUrl || '').split(',').map(u => normalize(u));
        return urls.includes(targetUrl);
    });

    const playingLibItem = !playingClip ? (libraryItems || []).find((i: any) => {
        const urls = (i.refImageUrl || '').split(',').map((u: string) => normalize(u));
        return urls.includes(targetUrl);
    }) : undefined;

    const isImage = (playingClip?.model?.includes('flux')) || (playingLibItem?.type !== undefined) || currentUrl?.match(/\.(jpeg|jpg|png|webp)$/i);

    // Edit State
    const [editValue, setEditValue] = useState("");
    const [isDirty, setIsDirty] = useState(false);

    // Sync Edit Value on Navigation
    useEffect(() => {
        if (playingClip) {
            setEditValue(playingClip.action || "");
        } else if (playingLibItem) {
            setEditValue(playingLibItem.description || "");
        } else {
            setEditValue("");
        }
        setIsDirty(false);
    }, [currentUrl, playingClip, playingLibItem]);

    if (!currentUrl) return null;

    const handleVideoEnded = () => {
        if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);
            setCurrentUrl(playlist[nextIndex]);
        } else {
            // End of playlist: DO NOT CLOSE
            // onClose(); 
        }
    };

    const handleSave = async () => {
        if (playingClip && onUpdateClip) {
            await onUpdateClip(playingClip.id, { action: editValue });
        } else if (playingLibItem && onUpdateLibrary) {
            await onUpdateLibrary(playingLibItem.id, { description: editValue });
        }
        onClose(); // Save and Close as requested
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-[90vw] max-w-5xl flex flex-col gap-4" onClick={e => e.stopPropagation()}>

                {/* Media Container */}
                <div className="relative aspect-video bg-black border border-zinc-800 shadow-2xl rounded-lg overflow-hidden group/player">
                    {/* Top Right Controls */}
                    <div className="absolute top-4 right-4 z-50 flex gap-2">
                        {/* Save Reference Image (Images Only) */}
                        {isImage && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                // User Expectation: "Save" means "Download to OS"
                                                if (currentUrl) await downloadFile(currentUrl, playingClip?.title || 'download');
                                            }}
                                            className="text-orange-500 hover:text-orange-400 hover:bg-black/20"
                                        >
                                            <span className="material-symbols-outlined !text-3xl">save</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Save to Computer</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {/* Download */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (currentUrl) await downloadFile(currentUrl, playingClip?.title || 'download');
                                        }}
                                        className="text-orange-500 hover:text-orange-400 hover:bg-black/40"
                                    >
                                        <span className="material-symbols-outlined !text-3xl">download</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Download File</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Close */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={onClose}
                                        className="text-orange-500 hover:text-orange-400 hover:bg-black/40"
                                    >
                                        <span className="material-symbols-outlined !text-3xl">close</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Close</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    {/* Navigation Chevrons (Conditional on Playlist > 1) */}
                    {playlist.length > 1 && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrev();
                                }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 z-50 backdrop-blur-sm border border-white/10"
                            >
                                <span className="material-symbols-outlined !text-2xl">chevron_left</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleNext();
                                }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 z-50 backdrop-blur-sm border border-white/10"
                            >
                                <span className="material-symbols-outlined !text-2xl">chevron_right</span>
                            </button>
                        </>
                    )}

                    {isImage ? (
                        <img
                            src={currentUrl}
                            className="w-full h-full object-contain"
                            alt="Generated Content"
                        />
                    ) : (
                        <video
                            src={currentUrl}
                            controls
                            autoPlay
                            className="w-full h-full object-contain"
                            onEnded={handleVideoEnded}
                        />
                    )}
                </div>

                {/* Edit Area */}
                {(playingClip || playingLibItem) && (
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <textarea
                                value={editValue}
                                onChange={(e) => {
                                    setEditValue(e.target.value);
                                    setIsDirty(true);
                                }}
                                placeholder={playingClip ? "Edit Action..." : "Edit Description..."}
                                className="w-full bg-stone-900/90 text-stone-200 border border-stone-800 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none h-20"
                            />
                        </div>
                        <div className="flex flex-col gap-1 justify-start">
                            {/* Save Button */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline-success"
                                            size="icon"
                                            onClick={handleSave}
                                            disabled={!isDirty}
                                            className="h-8 w-8"
                                            title="Save Changes"
                                        >
                                            <span className="material-symbols-outlined text-lg">check</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Save Changes</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
