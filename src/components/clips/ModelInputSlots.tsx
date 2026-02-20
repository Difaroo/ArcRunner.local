import React from 'react';
import { MediaDisplay } from '@/components/media/MediaDisplay';
import { X, AlertCircle } from 'lucide-react';
import { ModelConfig } from '@/lib/models';

interface ModelInputSlotsProps {
    modelConfig: ModelConfig;
    mediaItems: any[];
    onRemove: (item: any) => void;
    className?: string;
    orientation?: 'vertical' | 'horizontal';
}

export function ModelInputSlots({ modelConfig, mediaItems, onRemove, className, orientation = 'vertical' }: ModelInputSlotsProps) {
    // 1. Get Active Media (Sort > 0), Ordered Descending
    const activeMedia = mediaItems
        .filter(m => m.refImageSort && m.refImageSort > 0)
        .sort((a, b) => b.refImageSort - a.refImageSort);

    // 2. Determine Slots from Config
    let slots: { label: string, required?: boolean }[] = [];

    if (modelConfig.refImageSlots) {
        modelConfig.refImageSlots.forEach(slotDef => {
            const count = slotDef.maxCount || 1;
            for (let i = 0; i < count; i++) {
                slots.push({ label: slotDef.label });
            }
        });
    } else {
        slots = [{ label: 'Reference' }, { label: 'Reference' }, { label: 'Reference' }];
    }

    const isHorizontal = orientation === 'horizontal';

    return (
        <div className={`flex ${isHorizontal ? 'flex-row items-stretch' : 'flex-col'} h-full ${className}`}>
            {!isHorizontal && (
                <h3 className="text-xs text-amber-500 font-semibold mb-2 uppercase tracking-wider flex items-center gap-2">
                    Generation Inputs
                    <span className="text-secondary-foreground/50 text-[10px]">({activeMedia.length}/{slots.length})</span>
                </h3>
            )}

            <div className={`flex-1 ${isHorizontal ? 'flex flex-row gap-3 overflow-x-auto pb-2' : 'flex flex-col space-y-3 overflow-y-auto pr-2'}`}>
                {slots.map((slot, index) => {
                    const media = activeMedia[index];

                    return (
                        <div key={index} className={`flex gap-3 p-2 bg-stone-900/40 border border-stone-800 rounded-lg items-start ${isHorizontal ? 'aspect-[9/16] h-full flex-col' : 'min-h-[100px]'}`}>

                            {/* Header / Label */}
                            <div className={`${isHorizontal ? 'w-full flex justify-between items-center mb-1' : 'w-24 shrink-0 flex flex-col justify-center h-full pt-2'}`}>
                                <span className="text-amber-500/80 text-[10px] uppercase font-bold tracking-widest text-right">
                                    {slot.label}
                                </span>
                                {isHorizontal && (
                                    <span className="text-stone-600 text-[9px] text-right uppercase">
                                        Slot {index + 1}
                                    </span>
                                )}
                            </div>

                            {/* Slot Content */}
                            <div className="flex-1 relative aspect-[9/16] bg-stone-950 rounded border border-stone-800 border-dashed flex items-center justify-center overflow-hidden group">
                                {media ? (
                                    <>
                                        <MediaDisplay
                                            url={media.thumbnailPath || media.url}
                                            title={media.category}
                                            contentType={media.type === 'VIDEO' ? 'video' : 'image'}
                                            isThumbnail={!!media.thumbnailPath}
                                            className="w-full h-full object-contain" // Contain to show full image in slot
                                        />
                                        {/* Remove Button */}
                                        <button
                                            className="absolute top-1 right-1 p-1 bg-red-900/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemove(media);
                                            }}
                                        >
                                            <X className="w-3 h-3" />
                                        </button>

                                        {/* Info Badge */}
                                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[9px] rounded truncate max-w-[80%]">
                                            {media.category === 'STUDIO_REFERENCE' ? 'Studio Asset' : 'Reference'}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-stone-700 gap-1">
                                        <div className="w-8 h-8 rounded-full border border-stone-800 flex items-center justify-center">
                                            <span className="text-xs">+</span>
                                        </div>
                                        <span className="text-[9px] uppercase tracking-wide">Empty</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
