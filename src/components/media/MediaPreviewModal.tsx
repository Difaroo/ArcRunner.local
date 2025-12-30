
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { X, ZoomIn, Play, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MediaPreviewModalProps {
    isOpen: boolean
    onClose: () => void
    url: string
    type: 'video' | 'image'
    title?: string
}

export function MediaPreviewModal({ isOpen, onClose, url, type, title }: MediaPreviewModalProps) {
    if (!url) return null;

    // Proxy Helper (matches MediaDisplay logic)
    const getSrc = (u: string, type: 'image' | 'video') => {
        if (u.startsWith('/api/') || u.startsWith('/thumbnails/') || u.startsWith('/uploads/')) return u;
        if (type === 'image') return `/api/proxy-image?url=${encodeURIComponent(u)}`;
        return `/api/proxy-download?url=${encodeURIComponent(u)}`;
    }

    const src = getSrc(url, type);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden bg-black/95 border-stone-800">
                <DialogTitle className="sr-only">{title || 'Preview'}</DialogTitle>
                <DialogDescription className="sr-only">Media Preview</DialogDescription>
                <div className="relative w-full h-full flex flex-col">
                    {/* Header Overlay */}
                    <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
                        <h3 className="text-white/90 font-medium truncate px-2">{title || 'Preview'}</h3>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/20"
                                onClick={() => window.open(src, '_blank')}
                                title="Open Original"
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                            <DialogClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground text-white">
                                <X className="h-6 w-6" />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex items-center justify-center min-h-[50vh] max-h-[85vh] p-4">
                        {type === 'video' ? (
                            <video
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
