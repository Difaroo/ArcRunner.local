import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ModelInputSlotsV2 } from './ModelInputSlotsV2';
import { getModelConfig } from '@/lib/models';
import { Clip } from '@/types';

interface GenerationSlotsProps {
    clip: Clip;
    episodeId?: string;
    model: string;
    uiSlots: any[];
    onRemoveFromSlot: (slotRecord: any) => void;
    onReorderSlots: (sourceIndex: number, destIndex: number) => Promise<void>;
    onAddToSlot: (item: any) => Promise<void>;
}

export function GenerationSlots({
    clip,
    episodeId,
    model,
    uiSlots,
    onRemoveFromSlot,
    onReorderSlots,
    onAddToSlot
}: GenerationSlotsProps) {
    const slotContainerRef = useRef<HTMLDivElement>(null);

    const config = getModelConfig(model);
    const maxSlots = config.refImageSlots?.reduce((acc, slot) => acc + (slot.maxCount ?? 1), 0) || '—';

    return (
        <div
            ref={slotContainerRef}
            className={`flex-none w-fit max-w-[50%] bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800 relative`}
        >
            <div className="px-3 py-1 flex justify-between items-center group/slotsheader h-[34px]">
                <h3 className="text-xs text-stone-400 font-medium uppercase tracking-wider flex items-center">
                    <span>{config.label}</span>
                    <span className="text-orange-500 font-mono font-medium ml-2 tracking-tight">
                        {uiSlots.length}/{maxSlots}
                    </span>
                </h3>
                <div className="flex items-center">
                    <div className="relative w-5 h-5">
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id="bem-slots-upload"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    if (episodeId) formData.append('episode', episodeId);
                                    formData.append('clipId', clip.id.toString());

                                    const res = await fetch('/api/upload', {
                                        method: 'POST',
                                        body: formData,
                                    });

                                    if (!res.ok) throw new Error('Upload failed');
                                    const data = await res.json();

                                    await onAddToSlot({
                                        id: data.mediaId,
                                        url: data.url,
                                        type: 'IMAGE'
                                    });
                                } catch (err) {
                                    console.error('Upload error:', err);
                                } finally {
                                    if (e.target) e.target.value = '';
                                }
                            }}
                        />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline-primary"
                                        size="icon"
                                        className="w-5 h-5"
                                        onClick={() => document.getElementById('bem-slots-upload')?.click()}
                                    >
                                        <span className="material-symbols-outlined !text-[14px]">add</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Upload Image to Slots</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </div>
            <div className="px-1.5 pb-2 pt-0 h-full w-full">
                <ModelInputSlotsV2
                    modelConfig={config}
                    mediaItems={uiSlots as any}
                    onRemove={onRemoveFromSlot}
                    onAddSlot={() => { }}
                    onReorder={onReorderSlots}
                    orientation="horizontal"
                    className=""
                />
            </div>
        </div>
    );
}
