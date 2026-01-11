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
    let label = 'Unknown';
    if (item.resultForClip) label = `Scene ${item.resultForClip.scene}`;
    else if (item.referenceForClip) label = `Ref: Sc ${item.referenceForClip.scene}`;
    else if (item.studioItem) label = item.studioItem.name;

    return (
        <div className="group relative aspect-video w-full overflow-hidden rounded-md border bg-muted/50 transition-all hover:ring-2 hover:ring-primary/50">
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
                            <video
                                src={item.localPath || src} // Prefer localPath if explicitly set
                                className="h-full w-full object-cover"
                                muted
                                loop
                                playsInline
                                onMouseOver={e => e.currentTarget.play().catch(() => { })}
                                onMouseOut={e => e.currentTarget.pause()}
                                onError={(e) => {
                                    (e.target as HTMLVideoElement).style.display = 'none';
                                    e.currentTarget.parentElement?.classList.add('bg-destructive/10');
                                }}
                            />
                        );
                    } else {
                        return (
                            <img
                                src={item.localPath || src}
                                alt="Media"
                                className="h-full w-full object-cover"
                                loading="lazy"
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

            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 p-2 flex flex-col justify-end">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white truncate max-w-[70%]">{label}</span>
                    <div className="flex gap-1">
                        {isVideo && <Play className="h-4 w-4 text-white" />}
                        {!isVideo && <ImageIcon className="h-4 w-4 text-white" />}
                    </div>
                </div>

                <div className="mt-2 flex gap-2 justify-end">
                    <Button size="icon" variant="destructive" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDelete?.(item.id); }}>
                        <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="secondary" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); window.open(item.url, '_blank'); }}>
                        <Download className="h-3 w-3" />
                    </Button>
                </div>
            </div>

            {/* Click Handler */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => onSelect?.(item)} />
        </div>
    );
}
