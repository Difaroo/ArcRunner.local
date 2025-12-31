
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { X, ZoomIn, Play, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { downloadFile } from "@/lib/download-utils"

interface MediaPreviewModalProps {
    isOpen: boolean
    onClose: () => void
    url: string
    type: 'video' | 'image'
    title?: string
    urls?: string[] // Optional array for slideshow
}

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MediaPreviewModal({ isOpen, onClose, url, type, title, urls = [] }: MediaPreviewModalProps) {
    // If urls provided, use them. Else fallback to single url.
    // Filter out potential junk
    const validUrls = urls.length > 0
        ? urls.filter(u => u && !u.startsWith('TASK:') && !u.startsWith('waiting'))
        : [url].filter(u => u);

    const [currentIndex, setCurrentIndex] = useState(0);

    // Initial sync
    useEffect(() => {
        if (isOpen) {
            if (urls.length > 0) {
                const initialIndex = urls.indexOf(url);
                setCurrentIndex(initialIndex >= 0 ? initialIndex : 0);
            } else {
                setCurrentIndex(0);
            }
        }
    }, [isOpen, url, urls]);

    if (!isOpen || validUrls.length === 0) return null;

    const currentUrl = validUrls[currentIndex] || '';

    // Navigation
    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % validUrls.length);
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + validUrls.length) % validUrls.length);
    };

    // Proxy Helper (matches MediaDisplay logic)
    const getSrc = (u: string, type: 'image' | 'video') => {
        if (!u) return '';
        if (u.startsWith('/api/') || u.startsWith('/thumbnails/') || u.startsWith('/uploads/') || u.startsWith('/media/')) return u;
        if (type === 'image') return `/api/proxy-image?url=${encodeURIComponent(u)}`;
        return `/api/proxy-download?url=${encodeURIComponent(u)}`;
    }

    const src = getSrc(currentUrl, type);
    const hasMultiple = validUrls.length > 1;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden bg-black/95 border-stone-800 [&>button]:hidden" onKeyDown={(e) => {
                if (e.key === 'ArrowRight') setCurrentIndex((prev) => (prev + 1) % validUrls.length);
                if (e.key === 'ArrowLeft') setCurrentIndex((prev) => (prev - 1 + validUrls.length) % validUrls.length);
            }}>
                <DialogTitle className="sr-only">{title || 'Preview'}</DialogTitle>
                <DialogDescription className="sr-only">Media Preview</DialogDescription>
                <div className="relative w-full h-full flex flex-col">
                    {/* Header Overlay */}
                    <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                        <div className="flex flex-col pointer-events-auto">
                            <h3 className="text-white/90 font-medium truncate px-2">{title || 'Preview'}</h3>
                            {hasMultiple && (
                                <span className="text-white/50 text-xs px-2">Image {currentIndex + 1} of {validUrls.length}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 pointer-events-auto">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                                onClick={async () => {
                                    const filename = `${title || 'download'}.${type === 'video' ? 'mp4' : 'png'}`;
                                    await downloadFile(src, filename);
                                }}
                                title="Download File"
                            >
                                <Download className="h-5 w-5" />
                            </Button>
                            <DialogClose className="flex items-center justify-center rounded-md h-9 w-9 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10 transition-colors focus:outline-none disabled:pointer-events-none">
                                <X className="h-5 w-5" />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex items-center justify-center min-h-[50vh] max-h-[85vh] p-4 relative group">
                        {/* Navigation Arrows */}
                        {hasMultiple && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute left-4 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={handlePrev}
                                >
                                    <ChevronLeft className="h-8 w-8" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={handleNext}
                                >
                                    <ChevronRight className="h-8 w-8" />
                                </Button>
                            </>
                        )}

                        {type === 'video' ? (
                            <video
                                key={src} // Reset video on change
                                src={src}
                                controls
                                autoPlay
                                className="max-w-full max-h-full rounded shadow-2xl"
                            />
                        ) : (
                            <img
                                src={src}
                                alt={title || "Preview"}
                                className="max-w-full max-h-full object-contain rounded shadow-2xl"
                            />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
