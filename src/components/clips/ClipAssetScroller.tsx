import React from 'react';
import { MediaDisplay } from '@/components/media/MediaDisplay';
import { Loader2, ArrowRight } from 'lucide-react';

interface ClipAssetScrollerProps {
    mediaItems: any[];
    onSelect: (item: any) => void;
    isLoading?: boolean;
    className?: string;
    orientation?: 'vertical' | 'horizontal';
}

export function ClipAssetScroller({ mediaItems, onSelect, isLoading, className, orientation = 'horizontal' }: ClipAssetScrollerProps) {
    // Filter for pool items (sort 0 or null/undefined)
    const poolItems = mediaItems.filter(m => !m.refImageSort || m.refImageSort === 0);
    const isVertical = orientation === 'vertical';

    return (
        <div className={`flex flex-col ${className}`}>


            <div className={`flex-1 min-h-0 ${isVertical ? 'overflow-y-auto overflow-x-hidden' : 'overflow-x-auto overflow-y-hidden h-full'}`}>
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-stone-500">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
                    </div>
                ) : poolItems.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-stone-600 text-sm">
                        No assets in pool
                    </div>
                ) : (
                    <div className={`flex gap-3 px-2 ${isVertical ? 'flex-col w-full p-2' : 'flex-row h-full items-stretch pb-2 pt-0'}`}>
                        {poolItems.map(item => (
                            <div
                                key={item.id}
                                className={`group relative flex-shrink-0 cursor-pointer overflow-hidden rounded border border-stone-800 hover:border-primary hover:ring-1 hover:ring-primary transition-all ${isVertical ? 'w-full aspect-video' : 'h-full w-auto aspect-video'}`}
                            >
                                <div className="absolute inset-0 w-full h-full">
                                    <MediaDisplay
                                        url={item.thumbnailPath || item.url}
                                        title={item.category || 'Asset'}
                                        contentType={item.type === 'VIDEO' ? 'video' : 'image'}
                                        isThumbnail={!!item.thumbnailPath}
                                        className="w-full h-full object-cover"
                                    />
                                </div>


                                {/* Label badge if needed (Top Left now for Studio) */}
                                {(item.category === 'STUDIO_REFERENCE' || (item.category && item.category.startsWith('LIB_'))) && (
                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 border border-orange-500 text-orange-500 bg-black/40 tracking-wider text-[8px] rounded uppercase shadow-sm z-10 pointer-events-none">
                                        Studio
                                    </div>
                                )}

                                {/* Type Icon (Top Right) */}
                                <div className="absolute top-1 right-1 p-1 bg-black/60 rounded flex items-center justify-center backdrop-blur-sm z-10 pointer-events-none">
                                    <span className="material-symbols-outlined !text-[12px] text-stone-300">
                                        {item.category?.includes('CHARACTER') ? 'person' :
                                            item.category?.includes('LOCATION') ? 'location_on' :
                                                item.type === 'VIDEO' ? 'movie' : 'image'}
                                    </span>
                                </div>

                                {/* File Name / Asset Name (Bottom Left) */}
                                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-stone-300 text-[9px] rounded truncate max-w-[calc(100%-30px)] shadow-sm z-10 pointer-events-none backdrop-blur-sm">
                                    {item.name || (item.url ? item.url.split('/').pop() : 'Unnamed Asset')}
                                </div>

                                {/* Add to Slot / Assign Button (Bottom Right) */}
                                <button
                                    className="absolute bottom-1 right-1 h-[20px] w-[20px] flex items-center justify-center bg-orange-500 hover:bg-orange-400 text-black rounded shadow z-10 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); onSelect(item); }}
                                    title="Assign to Slot"
                                >
                                    <span className="material-symbols-outlined !text-[14px]">arrow_forward</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
