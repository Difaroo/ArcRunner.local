import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Download } from 'lucide-react';
import { MediaDisplay } from '@/components/media/MediaDisplay';
import { Clip } from '@/types';

interface LatestResultViewerProps {
    clip: Clip;
    episodeId?: string;
    derivedStatus: { state: string; isError?: boolean };
    isPersisting: boolean;
    onPersistMedia: (args: any) => Promise<{ success: boolean }>;
    onDataRefresh?: () => void;
    onAddToSlot: (item: any) => Promise<void>;
    onClearResult?: () => void;
    onFieldChange: (field: 'action' | 'dialog', value: string) => void;
}

export function LatestResultViewer({
    clip,
    episodeId,
    derivedStatus,
    isPersisting,
    onPersistMedia,
    onDataRefresh,
    onAddToSlot,
    onClearResult,
    onFieldChange
}: LatestResultViewerProps) {
    return (
        <div className="h-full aspect-video flex-shrink-0 bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800">
            <div className="px-3 py-1 flex justify-between items-center h-[34px]">
                <h3 className="text-xs text-stone-400 font-medium uppercase tracking-wider">Latest Result</h3>
                <div className="flex items-center gap-1">
                    {/* Sideload: Add result to MIS as reference */}
                    {clip.resultUrl && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 !text-orange-500 hover:!text-orange-400 hover:bg-orange-500/10"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            const resultUrl = clip.resultUrl!.split(',')[0].trim();
                                            await onAddToSlot({
                                                id: `sideload-${Date.now()}`,
                                                url: resultUrl,
                                                thumbnailPath: clip.thumbnailPath || '',
                                                type: resultUrl.match(/\.(mp4|webm|mov)/i) ? 'VIDEO' : 'IMAGE',
                                                category: 'REFERENCE',
                                                name: `Result → Ref`
                                            });
                                            // Clear the result from Latest Result viewer after sideloading to MIS
                                            onClearResult?.();
                                        }}
                                    >
                                        <span className="material-symbols-outlined !text-[14px]">arrow_back</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Make reference image</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {/* Persist / Download */}
                    {clip.resultUrl && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={clip.isPersisted ? 'ghost' : 'outline'}
                                        size="icon"
                                        className={`h-6 w-6 ${clip.isPersisted ? '!text-green-500 hover:!text-green-400 hover:bg-green-500/10' : '!text-orange-500 hover:!text-orange-400 border-orange-500/50 hover:bg-orange-500/10'}`}
                                        disabled={isPersisting}
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (clip.isPersisted) {
                                                try {
                                                    await fetch('/api/media/open-folder', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ episodeId })
                                                    });
                                                } catch (err) {
                                                    console.error('[BEM] Failed to open folder:', err);
                                                }
                                            } else {
                                                const result = await onPersistMedia({
                                                    clipId: String(clip.id),
                                                    episodeId,
                                                    url: clip.resultUrl
                                                });
                                                if (result.success) {
                                                    onDataRefresh?.();
                                                }
                                            }
                                        }}
                                    >
                                        {isPersisting ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : clip.isPersisted ? (
                                            <span className="material-symbols-outlined !text-[14px]">folder</span>
                                        ) : (
                                            <Download className="h-3 w-3" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{clip.isPersisted ? 'Open Edit Folder' : 'Download to Episode Folder'}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>
            <div className="flex-1 relative bg-black flex items-center justify-center min-h-0 w-full">
                {derivedStatus.state === 'Generating' ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-primary">
                        <Loader2 className="h-8 w-8 animate-spin opacity-80" />
                        <span className="text-xs font-mono uppercase tracking-widest text-primary/80">Generating...</span>
                    </div>
                ) : clip.resultUrl ? (
                    <MediaDisplay
                        key={`preview-${clip.id}-${clip.resultUrl}`}
                        url={clip.resultUrl}
                        originalUrl={clip.resultUrl}
                        posterUrl={clip.thumbnailPath}
                        ownerClipId={clip.id}
                        action={clip.action || undefined}
                        description={clip.dialog || undefined}
                        onUpdate={async (id, updates) => {
                            if (updates) {
                                if (updates.action !== undefined) {
                                    onFieldChange('action', updates.action);
                                }
                                if (updates.description !== undefined) {
                                    onFieldChange('dialog', updates.description);
                                }
                            }
                        }}
                    />
                ) : (
                    <span className="text-stone-600 text-xs uppercase tracking-widest">No Generation</span>
                )}
            </div>
        </div>
    );
}
