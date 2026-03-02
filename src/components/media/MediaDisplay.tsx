import { useState, useEffect } from "react"
import { PlayCircle, Eye, Maximize2 } from "lucide-react"
import { UniversalMediaViewer } from "./UniversalMediaViewer"

interface MediaDisplayProps {
    url: string // The source to display (thumbnail or direct)
    originalUrl?: string // The actual media source (if different from url, e.g. video source)
    model?: string // To help detection
    title?: string // Override title for preview modal (filename)
    onPlay?: (url: string) => void // Legacy/Override
    isThumbnail?: boolean // If true, force image rendering for the preview
    posterUrl?: string // Optional crisp poster image for video tags
    contentType?: 'video' | 'image' | 'auto' // Explicit type override
    className?: string
    description?: string // For UVM editing
    action?: string // For UVM editing
    onSave?: (url: string) => void
    onUseAsRef?: (url: string) => void
    onUpdate?: (id: string, updates: any) => Promise<void> | void
    onDelete?: (id: string) => Promise<void> | void
    onUnlink?: (url: string, contextId?: string, isResult?: boolean) => Promise<void> | void // Separate handler for unlinking references
    isReference?: boolean // Override context
    episodeId?: string; // For Persistence context
    ownerClipId?: string; // For Persistence context
    isPersisted?: boolean; // NEW: For UVM context
}

export function MediaDisplay({
    url,
    originalUrl,
    model,
    title, // Destructure title
    onPlay,
    isThumbnail,
    posterUrl,
    contentType = 'auto',
    className,
    description,
    action,
    onSave,
    onUseAsRef, // Destructure new prop
    onUpdate,
    onDelete,
    onUnlink, // Destructure unlink handler
    isReference = false, // Default to false (Root Asset) unless specified
    episodeId,
    ownerClipId, // NEW: Accept ownerClipId
    isPersisted = false // NEW: Accept persistence state
}: MediaDisplayProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [imgError, setImgError] = useState(false); // Track if proxy failed
    const [videoError, setVideoError] = useState(false); // Track if video failed

    // Reset error state if the URL changes (vital for reused components in BEM filmstrips/carousels)
    useEffect(() => {
        setImgError(false);
        setVideoError(false);
    }, [url, originalUrl]);

    // Handle comma-separated lists (take first)
    // PATCH v0.32+: Catch legacy /api/storage/ URLs from Database and rewrite them to modern /api/media/clips/
    const sanitizeUrl = (u: string | undefined) => (u ? u.split(',')[0].trim().replace('/api/storage/', '/api/media/clips/') : '');

    const effectiveUrl = sanitizeUrl(url);
    const effectiveOriginalUrl = sanitizeUrl(originalUrl) || effectiveUrl;
    const effectivePosterUrl = sanitizeUrl(posterUrl || '');

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
        const checkUrl = effectiveOriginalUrl || effectiveUrl;
        if (checkUrl.match(/\.(mp4|webm|mov)($|\?)/i)) return 'video';

        // Default to Image if unknown or image ext
        return 'image';
    }

    const type = getMediaType();

    // 2. Determine Display Format (How to show the preview)
    // If it's a thumbnail, or it's an Image type, we allow Image Tag.
    // If it's a Video type AND NOT a thumbnail, we allow Video Tag (preview).
    const isImageDisplay = isThumbnail || type === 'image';

    // Proxy Helper
    const getSrc = (u: string, t: 'image' | 'video') => {
        if (!u) return '';
        // Skip Proxy for Non-URLs (Status messages, TASK IDs, etc)
        const lower = u.toLowerCase();
        if (lower === 'waiting' || lower === 'generating' || lower.startsWith('task:') || lower.includes('error')) return '';

        if (u.startsWith('/api/') || u.startsWith('/thumbnails/') || u.startsWith('/uploads/') || u.startsWith('/media/')) return u;

        // Proxy Kie Google Storage videos to bypass CORS
        if (t === 'video' && u.includes('googleapis.com')) {
            return `/api/proxy-image?url=${encodeURIComponent(u)}`;
        }

        if (t === 'image') return `/api/proxy-image?url=${encodeURIComponent(u)}`;
        // For standard video previews, use the URL natively.
        return u;
    }

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (onPlay) {
            onPlay(effectiveOriginalUrl);
        } else {
            setIsModalOpen(true);
        }
    }

    // Parse all available URLs for slideshow (Sanitized to fix UVM playback)
    const allUrls = (originalUrl || url || '').split(',').map(u => sanitizeUrl(u.trim())).filter(Boolean);

    return (
        <>
            <div
                className={`relative group cursor-pointer w-full h-full ${className || ''}`}
                onClick={handleClick}
                draggable="true"
                onDragStart={(e) => {
                    const dragUrl = effectiveOriginalUrl || effectiveUrl;
                    if (dragUrl) {
                        e.dataTransfer.setData('text/plain', dragUrl);
                        e.dataTransfer.effectAllowed = 'copy';
                        console.log('Drag Start (Result):', dragUrl);
                    }
                }}
            >
                {/* Visual Representation */}
                {(imgError || videoError) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900 border border-stone-800 p-2 text-center">
                        <span className="material-symbols-outlined text-stone-600 mb-1">broken_image</span>
                        <span className="text-[10px] text-stone-600 leading-tight line-clamp-2 md:line-clamp-none break-all">
                            {title || (effectiveUrl ? effectiveUrl.split('/').pop() : 'Missing')}
                        </span>
                    </div>
                ) : isImageDisplay ? (
                    <img
                        src={imgError ? effectiveUrl : getSrc(effectiveUrl, 'image')}
                        className="w-full h-full object-cover rounded border border-stone-800 shadow-sm transition-opacity group-hover:opacity-90 active:cursor-grabbing"
                        alt="Preview"
                        loading="lazy"
                        onError={(e) => {
                            console.error(`[MediaDisplay] Native IMG load FATAL onError triggered in browser for URL: ${getSrc(effectiveUrl, 'image')}`);
                            setImgError(true);
                        }}
                    />
                ) : (
                    <video
                        src={getSrc(effectiveUrl, 'video')}
                        poster={effectivePosterUrl ? getSrc(effectivePosterUrl, 'image') : undefined}
                        className="w-full h-full object-cover rounded border border-stone-800 shadow-sm"
                        preload="metadata"
                        muted
                        playsInline
                        onMouseOver={e => e.currentTarget.play()}
                        onMouseOut={e => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                        }}
                        onError={(e) => {
                            console.error(`[MediaDisplay] Native VIDEO decoding FATAL onError triggered in browser for URL: ${getSrc(effectiveUrl, 'video')} ! Native Event Target Error:`, (e.target as HTMLVideoElement).error);
                            setVideoError(true);
                        }}
                    />
                )}

                {/* Overlays / Icons - Based on CONTENT TYPE */}
                {!videoError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors print:hidden">
                        {type === 'video' ? (
                            <span className="material-symbols-outlined text-white/90 text-[24px] drop-shadow-lg group-hover:scale-110 transition-transform">
                                play_circle
                            </span>
                        ) : (
                            !isReference && (
                                <span className="material-symbols-outlined text-white/80 text-[20px] drop-shadow-lg group-hover:scale-110 transition-transform opacity-0 group-hover:opacity-100">
                                    visibility
                                </span>
                            )
                        )}
                    </div>
                )}
            </div>

            <UniversalMediaViewer
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                playlist={allUrls.map(u => ({
                    id: effectiveOriginalUrl || u,
                    url: u,
                    type: (u && u.match(/\.(mp4|mov|webm)$/i)) ? 'video' : 'image',
                    title: title || model || 'Media Preview',
                    description: description, // Pass to UVM
                    action: action, // Pass to UVM
                    isReference: !!isReference, // Respect prop
                    episodeId, // Pass episodeId for persistence
                    ownerClipId, // Pass ownerClipId for persistence
                    isPersisted // NEW: Pass down value to UVM feedback Action Button
                }))}
                initialIndex={allUrls.indexOf(effectiveOriginalUrl || '')}
                onUpdate={onUpdate ? async (id, updates) => { await onUpdate(id, updates); } : undefined}
                // Map Delete logic:
                // If Reference: Pass Unlink handler (Minus Button)
                // If Root: Pass Delete handler (Trash Button)
                onDelete={!isReference && onDelete ? async (id) => { await onDelete(id); } : undefined}
                onUnlink={isReference && onUnlink ? async (url, contextId, isResult) => { if (onUnlink) await onUnlink(url, contextId, isResult); } : undefined}
            />
        </>
    )
}
