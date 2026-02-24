import React from 'react';
import { MediaDisplay } from '@/components/media/MediaDisplay';
import { ArrowLeft } from 'lucide-react';
import { ModelConfig } from '@/lib/models';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ModelInputSlotsProps {
    modelConfig: ModelConfig;
    mediaItems: any[];
    onRemove: (item: any) => void;
    onUpdate?: (id: string, updates: any) => Promise<void> | void;
    onReorder?: (sourceIndex: number, destIndex: number) => void;
    className?: string;
    orientation?: 'vertical' | 'horizontal';
}

export function ModelInputSlotsV2({ modelConfig, mediaItems, onRemove, onUpdate, onReorder, className, orientation = 'vertical' }: ModelInputSlotsProps) {
    // 1. Structure the Active Media
    const activeMedia = mediaItems || [];

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

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const sourceIndex = parseInt(active.id.toString().split('-')[1]);
        const destIndex = parseInt(over.id.toString().split('-')[1]);

        if (onReorder) {
            onReorder(sourceIndex, destIndex);
        }
    };

    return (
        <div className={`debug-port-verified flex ${isHorizontal ? 'flex-row items-stretch gap-1.5 pb-[5px]' : 'flex-col space-y-3 overflow-y-auto pr-2 flex-1'} h-full ${className}`}>
            {!isHorizontal && (
                <h3 className="text-xs text-amber-500 font-semibold mb-2 uppercase tracking-wider flex items-center gap-2">
                    Generation Inputs
                    <span className="text-secondary-foreground/50 text-[10px]">({activeMedia.length}/{slots.length})</span>
                </h3>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={slots.map((_, i) => `slot-${i}`)} strategy={isHorizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}>
                    {slots.map((slot, index) => {
                        const media = activeMedia[index];
                        return (
                            <SortableSlotItem
                                key={`slot-${index}`}
                                id={`slot-${index}`}
                                slot={slot}
                                media={media}
                                isHorizontal={isHorizontal}
                                onRemove={onRemove}
                                onUpdate={onUpdate}
                            />
                        );
                    })}
                </SortableContext>
            </DndContext>
        </div>
    );
}

function SortableSlotItem({ id, slot, media, isHorizontal, onRemove, onUpdate }: any) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className={`flex flex-col bg-stone-900/40 border border-stone-700 rounded-lg overflow-hidden flex-shrink-0 ${isHorizontal ? 'aspect-[9/16] h-full w-auto' : 'min-h-[100px]'}`}>
            <div
                className={`flex-1 relative w-full h-full ${media ? 'bg-stone-950' : 'bg-stone-900/20'} flex items-center justify-center overflow-hidden group ${media ? 'cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-stone-500' : ''} transition-all`}
                {...(media ? listeners : {})}
                {...(media ? attributes : {})}
            >
                {media ? (
                    <>
                        {/* Slot Content - Full Bleed */}
                        <div className="absolute inset-0 w-full h-full">
                            <MediaDisplay
                                url={media.thumbnailPath || media.url}
                                title={media.category}
                                description={media.description}
                                action={media.action}
                                contentType={media.type === 'VIDEO' ? 'video' : 'image'}
                                isThumbnail={!!media.thumbnailPath}
                                className="w-full h-full object-cover"
                                onUpdate={onUpdate && media.originalId && media.isStudioItem ? async (_, updates) => await onUpdate(media.originalId, updates) : undefined}
                            />
                        </div>

                        {/* Type Icon (Top Right) */}
                        <div className="absolute top-1 right-1 p-1 bg-black/60 rounded flex items-center justify-center backdrop-blur-sm z-10 pointer-events-none">
                            <span className="material-symbols-outlined !text-[12px] text-stone-300">
                                {media.category?.includes('CHARACTER') ? 'person' :
                                    media.category?.includes('LOCATION') ? 'location_on' :
                                        media.type === 'VIDEO' ? 'movie' : 'image'}
                            </span>
                        </div>

                        {/* Bottom Right Actions (Padlock or Remove Button) */}
                        {media.isAutoPopulated ? (
                            <div className="absolute bottom-1 right-1 w-5 h-5 flex items-center justify-center z-10 pointer-events-none drop-shadow-md">
                                <span className="material-symbols-outlined !text-[12px] text-orange-500">lock</span>
                            </div>
                        ) : (
                            <button
                                className="absolute bottom-1 right-1 h-5 w-5 bg-orange-500 hover:bg-orange-400 text-black flex items-center justify-center rounded shadow-sm z-20 transition-colors pointer-events-auto"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(media);
                                }}
                                title="Remove reference"
                                onPointerDown={(e) => e.stopPropagation()}
                            >
                                <ArrowLeft className="h-3 w-3" />
                            </button>
                        )}

                        {/* Info Badge (Orange with Black text) - Strictly structurally mapped to the slot label */}
                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-orange-500 text-black font-normal text-[9px] uppercase rounded shadow overflow-hidden z-10 max-w-[calc(100%-36px)] truncate pointer-events-none">
                            {slot.label}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center text-stone-700 gap-1 h-full w-full pointer-events-none">
                        <div className="w-8 h-8 rounded-full border border-stone-800/50 flex items-center justify-center text-stone-600 group-hover:border-stone-600 group-hover:text-stone-400 transition-colors">
                            <span className="text-xs">+</span>
                        </div>
                        <span className="text-[9px] uppercase tracking-wide text-stone-600">{slot.label}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
