import { useState } from "react"
import { PlayCircle, Eye } from "lucide-react"

interface MediaDisplayProps {
    url: string
    model?: string // Optional info to help detection
    onPlay: (url: string) => void
    className?: string
}

export function MediaDisplay({ url, model, onPlay, className }: MediaDisplayProps) {
    // Detection Logic
    const isImage = (model?.toLowerCase().includes('flux')) ||
        url.match(/\.(jpeg|jpg|png|webp)($|\?)/i);

    // Proxy Helper
    // If it starts with /api/, it's already a local proxy url.
    // If it's a remote URL, wrap it.
    const getSrc = (u: string, type: 'image' | 'video') => {
        if (u.startsWith('/api/')) return u;
        if (type === 'image') return `/api/proxy-image?url=${encodeURIComponent(u)}`;
        return `/api/proxy-download?url=${encodeURIComponent(u)}`;
    }

    if (isImage) {
        return (
            <div
                className={`relative group cursor-pointer w-full h-full ${className || ''}`}
                onClick={() => onPlay(url)}
            >
                <img
                    src={getSrc(url, 'image')}
                    className="w-full h-full object-cover rounded border border-stone-600 shadow-sm"
                    alt="Result"
                    loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                    {/* Using Lucide Icon for consistency, fallback to material symbol if needed, 
                        Methodology says to match existing style. ClipRow used material symbols: visibility 
                        Let's stick to Material Symbols to match exact look if possible, or Lucide if requested.
                        The existing codebase uses BOTH. ClipRow used <span className="material-symbols-outlined">visibility</span>
                        I will stick to the existing class-based icon for visual regression safety.
                      */}
                    <span className="material-symbols-outlined text-white/80 text-[20px] drop-shadow-md group-hover:scale-110 transition-transform">visibility</span>
                </div>
            </div>
        )
    } else {
        // Video
        return (
            <div
                className={`relative group cursor-pointer w-full h-full ${className || ''}`}
                onClick={() => onPlay(url)}
            >
                <video
                    src={getSrc(url, 'video')}
                    className="w-full h-full object-cover rounded border border-stone-600 shadow-sm"
                    preload="metadata"
                    muted
                    playsInline
                    onMouseOver={e => e.currentTarget.play()}
                    onMouseOut={e => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                    }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/0 transition-colors">
                    <span className="material-symbols-outlined text-white/80 text-[20px] drop-shadow-md group-hover:scale-110 transition-transform">play_circle</span>
                </div>
            </div>
        )
    }
}
