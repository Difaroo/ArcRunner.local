import { useState } from "react"
import { PlayCircle, Eye, Maximize2 } from "lucide-react"
import { MediaPreviewModal } from "./MediaPreviewModal"

interface MediaDisplayProps {
    url: string // The source to display (thumbnail or direct)
    originalUrl?: string // The actual media source (if different from url, e.g. video source)
    model?: string // To help detection
    onPlay?: (url: string) => void // Legacy/Override
    isThumbnail?: boolean // If true, force image rendering for the preview
    contentType?: 'video' | 'image' | 'auto' // Explicit type override
    className?: string
}

export function MediaDisplay({
    url,
    originalUrl,
    model,
    onPlay,
    isThumbnail,
    contentType = 'auto',
    className
}: MediaDisplayProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 1. Determine Content Type (What it IS)
    // If explicit type provided, use it. Else detect.
    const getMediaType = (): 'video' | 'image' => {
        if (contentType !== 'auto') return contentType;

        const lowerModel = (model || '').toLowerCase();
        // Known Video Models
        if (lowerModel.includes('veo') || lowerModel.includes('luma') || lowerModel.includes('runway') || lowerModel.includes('kling')) return 'video';
        // Known Image Models
        if (lowerModel.includes('flux') || lowerModel.includes('dalle') || lowerModel.includes('midjourney')) return 'image';

        // Fallback to Extension on ORIGINAL url (most accurate)
        const checkUrl = originalUrl || url;
        if (checkUrl.match(/\.(mp4|webm|mov)($|\?)/i)) return 'video';

        // Default to Image if unknown or image ext
        return 'image';
    }

    const type = getMediaType();
    const effectiveOriginalUrl = originalUrl || url;

    // 2. Determine Display Format (How to show the preview)
    // If it's a thumbnail, or it's an Image type, we allow Image Tag.
    // If it's a Video type AND NOT a thumbnail, we allow Video Tag (preview).
    const isImageDisplay = isThumbnail || type === 'image';

    // Proxy Helper
    const getSrc = (u: string, t: 'image' | 'video') => {
        if (!u) return '';
        if (u.startsWith('/api/') || u.startsWith('/thumbnails/') || u.startsWith('/uploads/')) return u;
        if (t === 'image') return `/api/proxy-image?url=${encodeURIComponent(u)}`;
        return `/api/proxy-download?url=${encodeURIComponent(u)}`;
    }

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onPlay) {
            onPlay(effectiveOriginalUrl);
        } else {
            setIsModalOpen(true);
        }
    }

    return (
        <>
            <div
                className={`relative group cursor-pointer w-full h-full ${className || ''}`}
                onClick={handleClick}
            >
                {/* Visual Representation */}
                {isImageDisplay ? (
                    <img
                        src={getSrc(url, 'image')}
                        className="w-full h-full object-cover rounded border border-stone-800 shadow-sm transition-opacity group-hover:opacity-90"
                        alt="Preview"
                        loading="lazy"
                        onError={(e) => {
                            // If thumbnail fails, maybe try to load video directly?
                            // For now, simple fallback styling?
                            (e.target as HTMLImageElement).style.opacity = '0.5';
                        }}
                    />
                ) : (
                    <video
                        src={getSrc(url, 'video')}
                        className="w-full h-full object-cover rounded border border-stone-800 shadow-sm"
                        preload="metadata"
                        muted
                        playsInline
                        onMouseOver={e => e.currentTarget.play()}
                        onMouseOut={e => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                        }}
                    />
                )}

                {/* Overlays / Icons - Based on CONTENT TYPE */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors print:hidden">
                    {type === 'video' ? (
                        <span className="material-symbols-outlined text-white/90 text-[24px] drop-shadow-lg group-hover:scale-110 transition-transform">
                            play_circle
                        </span>
                    ) : (
                        <span className="material-symbols-outlined text-white/80 text-[20px] drop-shadow-lg group-hover:scale-110 transition-transform opacity-0 group-hover:opacity-100">
                            visibility
                        </span>
                    )}
                </div>
            </div>

            <MediaPreviewModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                url={effectiveOriginalUrl}
                type={type}
                title={model || 'Media Preview'}
            />
        </>
    )
}
