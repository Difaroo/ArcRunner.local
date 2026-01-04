
import React, { useEffect, useState } from 'react';
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

export function VideoPlayerOverlay({
    url,
    onClose,
    playlist = [],
    initialIndex = -1,
    clips = [],
    archiveMedia,
    isArchiving
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

    if (!currentUrl) return null;

    const handleVideoEnded = () => {
        if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);
            setCurrentUrl(playlist[nextIndex]);
        } else {
            // End of playlist
            onClose();
        }
    };

    // Determine media type
    const playingClip = clips.find(c => c.resultUrl === currentUrl) || { model: '' };
    const isImage = playingClip.model?.includes('flux') || currentUrl?.match(/\.(jpeg|jpg|png|webp)$/i);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-[90vw] max-w-5xl aspect-video bg-black border border-zinc-800 shadow-2xl rounded-lg overflow-hidden group/player" onClick={e => e.stopPropagation()}>
                {/* Top Right Controls */}
                <div className="absolute top-4 right-4 z-50 flex gap-2">
                    <button
                        onClick={onClose}
                        className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Bottom Controls Overlay (Visible on Hover) */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 z-40 flex justify-between items-end pointer-events-none">
                    <div className="pointer-events-auto">
                        {/* Playlist Counter */}
                        {playlist.length > 0 && (
                            <div className="bg-black/50 text-white text-xs px-2 py-1 rounded inline-block mb-2">
                                Playing {currentIndex + 1} of {playlist.length}
                            </div>
                        )}
                    </div>

                    <div className="pointer-events-auto">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await archiveMedia(currentUrl);
                                        }}
                                        disabled={isArchiving}
                                    >
                                        {isArchiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <span className="material-symbols-outlined !text-sm mr-2">save</span>}
                                        {isArchiving ? "Saving..." : "Save Reference Image"}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Download to local storage and set as permanent reference</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

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
        </div>
    );
}
