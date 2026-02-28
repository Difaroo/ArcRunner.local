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
    onAddSlot?: () => void;
    className?: string;
    orientation?: 'vertical' | 'horizontal';
}

export function ModelInputSlotsV2({ modelConfig, mediaItems, onRemove, onUpdate, onReorder, onAddSlot, className, orientation = 'vertical' }: ModelInputSlotsProps) {
    // 1. Structure the Active Media (Expected to be an array of ModelInputSlot join records)
    const activeSlots = mediaItems || [];

    // 2. Slots are 1:1 with active data — no pre-spawning from model config.
    // Each filled slot gets a label from the model config for display purposes.
    const defaultLabel = modelConfig.refImageSlots?.[0]?.label || 'Reference';
    const slots: { label: string }[] = activeSlots.map(() => ({ label: defaultLabel }));

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
                    <span className="text-secondary-foreground/50 text-[10px]">({activeSlots.length})</span>
                </h3>
            )}

            {/* Empty state: no slots filled */}
            {activeSlots.length === 0 && (
                <div
                    className={`flex flex-col items-center justify-center gap-1.5 ${isHorizontal ? 'h-full w-full flex-1' : 'min-h-[100px]'} cursor-pointer`}
                    onClick={onAddSlot}
                    title="Upload reference image"
                >
                    <div className="w-10 h-10 rounded-full border border-orange-500/50 flex items-center justify-center">
                        <span className="material-symbols-outlined text-orange-500 !text-[16px]">add</span>
                    </div>
                    <span className="text-[9px] text-orange-500 uppercase tracking-wider font-medium">Add Reference</span>
                </div>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={slots.map((_, i) => `slot-${i}`)} strategy={isHorizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}>
                    {slots.map((slot, index) => {
                        const slotRecord = activeSlots[index];
                        const media = slotRecord?.media || (slotRecord?.studioItem ? {
                            id: `studio-${slotRecord.studioItem.id}`,
                            originalId: slotRecord.studioItem.id.toString(),
                            url: slotRecord.studioItem.refImageUrl ? slotRecord.studioItem.refImageUrl.split(',')[0] : '',
                            thumbnailPath: slotRecord.studioItem.thumbnailPath ? slotRecord.studioItem.thumbnailPath.split(',')[0] : '',
                            category: slotRecord.studioItem.type,
                            name: slotRecord.studioItem.name,
                            isStudioItem: true,
                            type: 'IMAGE'
                        } : null);

                        // Debug log for inserted Studio Items
                        if (slotRecord?.studioItem) {
                            console.log('[DEBUG SLOT] Synthetic Media Object:', media);
                        }

                        return (
                            <SortableSlotItem
                                key={`slot-${index}`}
                                id={`slot-${index}`}
                                slot={slot}
                                slotRecord={slotRecord}
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

function SortableSlotItem({ id, slot, slotRecord, media, isHorizontal, onRemove, onUpdate }: any) {
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
                            {(media.thumbnailPath || media.url) ? (
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
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900 border border-stone-800 p-2 text-center">
                                    <span className="text-[10px] text-stone-500 font-medium uppercase tracking-wider mb-1 line-clamp-1 break-all">
                                        {media.name || 'Missing Image'}
                                    </span>
                                    <span className="text-[8px] text-stone-600 uppercase">
                                        Pending Upload
                                    </span>
                                </div>
                            )}
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
                                    onRemove(slotRecord);
                                }}
                                title="Remove reference"
                                onPointerDown={(e) => e.stopPropagation()}
                            >
                                <ArrowLeft className="h-3 w-3" />
                            </button>
                        )}

                        {/* Info Badge - Solid orange for legit slots, outline for overflow */}
                        <div className={`absolute bottom-1 left-1 px-1.5 py-0.5 font-normal text-[9px] uppercase rounded shadow overflow-hidden z-10 max-w-[calc(100%-36px)] truncate pointer-events-none ${slot.label === 'Overflow' ? 'border border-orange-500 text-orange-500 bg-transparent' : 'bg-orange-500 text-black'}`}>
                            {slot.label}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
