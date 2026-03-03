import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipAssetScroller } from './ClipAssetScroller';
import { Clip } from '@/types';

interface AssetPoolProps {
    clip: Clip;
    episodeId?: string;
    poolItems: any[];
    mediaItems: any[];
    onAddToSlot: (item: any) => Promise<void>;
    onDataRefresh?: () => void;
}

export function AssetPool({
    clip,
    episodeId,
    poolItems,
    mediaItems,
    onAddToSlot,
    onDataRefresh
}: AssetPoolProps) {
    return (
        <div className="flex-1 min-w-0 flex-shrink bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800 min-h-0">
            <div className="px-3 py-1 flex justify-between items-center group/poolheader h-[34px]">
                <div className="flex items-center gap-2">
                    <h3 className="text-xs text-stone-400 font-medium uppercase tracking-wider">Asset Pool</h3>
                    <span className="text-xs text-orange-500 font-mono font-medium">
                        {poolItems.length}
                    </span>
                </div>
                <div className="flex items-center">
                    <div className="relative w-5 h-5">
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id="bem-pool-upload"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    if (episodeId) formData.append('episode', episodeId);

                                    const res = await fetch('/api/upload', {
                                        method: 'POST',
                                        body: formData,
                                    });

                                    if (!res.ok) throw new Error('Upload failed');
                                    const data = await res.json();

                                    await fetch('/api/media/add-ref', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            url: data.url,
                                            targetClipId: clip.id,
                                            action: 'copy'
                                        })
                                    });

                                    if (onDataRefresh) onDataRefresh();
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
                                        onClick={() => document.getElementById('bem-pool-upload')?.click()}
                                    >
                                        <span className="material-symbols-outlined !text-[14px]">add</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Upload Image to Pool</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </div>
            <ClipAssetScroller
                mediaItems={poolItems}
                onSelect={onAddToSlot}
                onUnlink={async (item) => {
                    try {
                        // The pool shouldn't destroy the active clip result even if the item originated as a result.
                        // We only want to unlink it from the pool (which is currently just deleting the media record or its reference).
                        const isResult = false;
                        await fetch('/api/media/unlink', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                url: item.url,
                                clipId: clip.id,
                                isResult
                            })
                        });
                        if (onDataRefresh) onDataRefresh();
                    } catch (e) {
                        console.error('Failed to unlink pool item', e);
                    }
                }}
                isLoading={false}
                orientation="horizontal"
                className="flex-1 w-full"
                onUpdate={async (id, updates) => {
                    const item = mediaItems.find(m => m.id === id);
                    if (!item) return;
                    try {
                        if (item.isStudioItem) {
                            await fetch('/api/library', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: item.studioItemId, description: updates.description })
                            });
                        } else {
                            await fetch('/api/media', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id, action: updates.action, description: updates.description })
                            });
                        }
                        if (onDataRefresh) onDataRefresh();
                    } catch (e) {
                        console.error('Failed to update media item from pool', e);
                    }
                }}
            />
        </div>
    );
}
