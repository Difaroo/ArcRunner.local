'use client';

import React from 'react';
import type { Media } from '@prisma/client';
import { Play, Image as ImageIcon, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaWithRelations extends Media {
    resultForClip?: any;
    referenceForClip?: any;
    studioItem?: any;
}

interface MediaGridProps {
    items: MediaWithRelations[];
    onDelete?: (id: string) => void;
    onSelect?: (media: Media) => void;
}

export function MediaGrid({ items, onDelete, onSelect }: MediaGridProps) {
    if (items.length === 0) {
        return (
            <div className="flex h-64 w-full flex-col items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
                <p>No media found</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => (
                <MediaCard key={item.id} item={item} onDelete={onDelete} onSelect={onSelect} />
            ))}
        </div>
    );
}

function MediaCard({ item, onDelete, onSelect }: { item: MediaWithRelations, onDelete?: (id: string) => void, onSelect?: (m: Media) => void }) {
    const isVideo = item.type === 'VIDEO';

    // Label Logic
    // Label Logic
    let label = 'Unknown';
    if (item.resultForClip) {
        const scene = item.resultForClip.scene || '??';
        const title = item.resultForClip.title || 'Untitled';
        label = `${scene} ${title}`;
    }
    else if (item.referenceForClip) {
        const scene = item.referenceForClip.scene || '??';
        const title = item.referenceForClip.title || 'Untitled';
        label = `Ref: ${scene} ${title}`;
    }
    else if (item.studioItem) {
        label = item.studioItem.name;
    }

    return (
        <div
            className="group relative aspect-video w-full overflow-hidden rounded-md border bg-muted/50 transition-all hover:ring-2 hover:ring-primary/50 cursor-pointer"
            onClick={() => onSelect?.(item)}
        >
            {/* Visual */}
            {/* Visual */
                (() => {
                    const rawUrl = item.localPath || item.url || '';
                    const isBadUrl = rawUrl.includes('Error') || rawUrl.includes('Generating') || rawUrl.includes('Waiting');

                    if (!rawUrl || isBadUrl) {
                        return (
                            <div className="flex h-full w-full items-center justify-center bg-muted">
                                <span className="material-symbols-outlined text-muted-foreground/50">broken_image</span>
                            </div>
                        );
                    }

                    // Smart Source Resolution: Only proxy remote HTTP(S) urls. Local paths use direct access.
                    const src = (rawUrl.startsWith('http') && !rawUrl.includes('localhost'))
                        ? `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`
                        : rawUrl;

                    if (isVideo) {
                        return (
                            <div className="relative h-full w-full bg-zinc-900 flex items-center justify-center">
                                {/* Fallback overlay while video loads */}
                                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                    <Play className="h-12 w-12 text-white/50" />
                                </div>
                                <video
                                    src={item.localPath || src} // Prefer localPath if explicitly set
                                    className="h-full w-full object-cover relative z-20 cursor-pointer"
                                    muted
                                    loop
                                    playsInline
                                    preload="metadata"
                                    onClick={() => onSelect?.(item)}
                                    onMouseOver={e => e.currentTarget.play().catch(() => { })}
                                    onMouseOut={e => e.currentTarget.pause()}
                                    onLoadedData={e => {
                                        // Hide the fallback once video loads
                                        const fallback = e.currentTarget.previousElementSibling;
                                        if (fallback) (fallback as HTMLElement).style.display = 'none';
                                    }}
                                    onError={(e) => {
                                        // On error, hide video and show icon
                                        (e.target as HTMLVideoElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        );
                    } else {
                        return (
                            <img
                                src={item.localPath || src}
                                alt="Media"
                                className="h-full w-full object-cover cursor-pointer"
                                loading="lazy"
                                onClick={() => onSelect?.(item)}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) {
                                        const span = document.createElement('span');
                                        span.className = "material-symbols-outlined text-destructive/50";
                                        span.innerText = "image_not_supported";
                                        parent.classList.add("flex", "items-center", "justify-center", "bg-muted");
                                        parent.appendChild(span);
                                    }
                                }}
                            />
                        );
                    }
                })()
            }

            {/* Top Right Type Icon */}
            <div className="absolute top-2 right-2 z-20">
                {/* Float with no background */}
                {isVideo && <Play className="h-4 w-4 text-white drop-shadow-md" />}
                {!isVideo && <ImageIcon className="h-4 w-4 text-white drop-shadow-md" />}
            </div>

            {/* Bottom Bar: Title & Controls */}
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8 transition-all">
                {/* Title (Always Visible) */}
                <span className="text-xs font-normal text-white truncate max-w-[60%] select-none drop-shadow-md">
                    {label}
                </span>

                {/* Controls (Hover Only) - pointer-events-auto to not be blocked by parent onClick */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto z-40">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 bg-black/20 text-red-500 hover:bg-red-500 hover:text-white backdrop-blur-sm transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this media?')) {
                                onDelete?.(item.id);
                            }
                        }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 bg-black/20 text-orange-500 hover:bg-orange-500 hover:text-white backdrop-blur-sm transition-colors"
                        onClick={(e) => { e.stopPropagation(); window.open(item.url, '_blank'); }}
                    >
                        <Download className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>


        </div>
    );
}
