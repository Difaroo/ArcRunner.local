import { EditableCell } from "@/components/ui/EditableCell"
import { TableCell } from "@/components/ui/table"
import { Clip } from "@/types"
import { parseStringList } from '@/lib/utils/string-helpers'
import { MediaDisplay } from "@/components/media/MediaDisplay"
import React from "react"

export interface ClipRowDisplayCellsProps {
    clip: Clip;
    handleStartEdit: () => void;
    onResolveImage?: (name: string) => string | undefined;
    onStudioAssetClick?: (name: string, type: 'CHARACTER' | 'LOCATION') => void;
    getEffectiveRefs: () => string[];
    isRefDragOver: boolean;
    setIsRefDragOver: (over: boolean) => void;
    handleRefDropRef: (e: React.DragEvent) => Promise<void>;
    handleRefUnlink: (url: string) => void;
    onPlay: (url: string, contextPlaylist?: any[]) => void;
}

export function ClipRowDisplayCells({
    clip,
    handleStartEdit,
    onResolveImage,
    onStudioAssetClick,
    getEffectiveRefs,
    isRefDragOver,
    setIsRefDragOver,
    handleRefDropRef,
    handleRefUnlink,
    onPlay
}: ClipRowDisplayCellsProps) {

    // Helper: resolve URL from a ModelInputSlot record
    const getMISSlotUrl = (slot: any): string => {
        if (slot.media) return slot.media.url || slot.media.thumbnailPath || '';
        if (slot.studioItem) return slot.studioItem.refImageUrl?.split(',')[0] || slot.studioItem.thumbnailPath?.split(',')[0] || '';
        return '';
    };

    return (
        <>
            <TableCell className={`align-top font-sans font-extralight text-stone-500 text-xs w-[35px] px-1 py-3`}>
                <EditableCell isEditing={false} onStartEdit={handleStartEdit} className="text-stone-500">
                    {clip.scene}
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top w-[160px] py-3`}>
                <EditableCell isEditing={false} onStartEdit={handleStartEdit} className="font-medium text-white block">
                    <span className="text-xs text-white leading-tight font-sans font-medium -translate-y-[5px] inline-block">{clip.title || '+'}</span>
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top w-[170px] py-3`} data-testid="cell-character">
                <EditableCell isEditing={false} onStartEdit={handleStartEdit} className="text-white whitespace-pre-line text-xs font-sans font-extralight">
                    <div className="flex flex-col gap-2 max-h-[70px] overflow-hidden">
                        {clip.character
                            ? clip.character.split(',').map((char, i, arr) => (
                                <div key={i} className="leading-tight truncate" title={char.trim()}>{char.trim()}{i < arr.length - 1 ? ',' : ''}</div>
                            ))
                            : <span className="text-stone-500 italic">+</span>
                        }
                        {clip.characterImageUrls && clip.characterImageUrls.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {clip.characterImageUrls.map((url, i) => {
                                    // Get character name from URL index
                                    const chars = parseStringList(clip.character || "");
                                    const charName = chars[i] || chars[0]; // Fallback to first if index mismatch
                                    return (
                                        <img
                                            key={i}
                                            src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                            alt="Char Ref"
                                            className="w-[40px] h-[40px] object-cover rounded border border-white/10 shadow-sm cursor-pointer hover:opacity-75 transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (charName) {
                                                    onStudioAssetClick?.(charName, 'CHARACTER');
                                                }
                                            }}
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            title={charName}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top w-[170px] py-3`}>
                <EditableCell isEditing={false} onStartEdit={handleStartEdit} className="text-white">
                    <div className="flex flex-col gap-2 max-h-[70px] overflow-hidden">
                        <span className="text-xs text-white leading-tight font-sans font-extralight truncate block" title={clip.location || ''}>{clip.location || '+'}</span>
                        {clip.locationImageUrls && clip.locationImageUrls.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {clip.locationImageUrls.map((url, i) => (
                                    <img
                                        key={i}
                                        src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                        alt={"Loc Ref"}
                                        className="w-[40px] h-[40px] object-cover rounded border border-white/10 shadow-sm cursor-pointer hover:opacity-75 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const locationName = clip.location?.trim();
                                            if (locationName) {
                                                onStudioAssetClick?.(locationName, 'LOCATION');
                                            }
                                        }}
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top text-white text-xs w-[140px] py-3`}>
                <EditableCell isEditing={false} onStartEdit={handleStartEdit}>
                    <div className="flex flex-col gap-1 w-full h-full max-h-[70px] overflow-hidden">
                        <span className="text-xs text-white leading-tight font-sans font-extralight truncate block">{clip.camera || '+'}</span>
                        {clip.negativePrompt ? (
                            <div className="flex flex-col gap-0 mt-2">
                                <span className="font-medium text-stone-500 text-[10px] tracking-wider uppercase">NEGATE</span>
                                <span className="text-xs text-white leading-tight font-sans font-extralight line-clamp-2" title={clip.negativePrompt}>{clip.negativePrompt}</span>
                            </div>
                        ) : null}
                    </div>
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top text-white w-[15%] py-3`}>
                <EditableCell isEditing={false} onStartEdit={handleStartEdit} className="leading-relaxed">
                    <span className="text-xs text-white leading-tight font-sans font-thin line-clamp-3 text-ellipsis overflow-hidden whitespace-pre-wrap break-words" title={clip.action || ''}>{clip.action || '+'}</span>
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top text-white w-[15%] py-3`}>
                <EditableCell isEditing={false} onStartEdit={handleStartEdit} className="text-white">
                    <span className="text-xs text-white leading-tight font-sans font-thin line-clamp-3 text-ellipsis overflow-hidden whitespace-pre-wrap break-words" title={clip.dialog || ''}>{clip.dialog || '+'}</span>
                </EditableCell>
            </TableCell>

            <TableCell className="align-top py-3 w-[80px] text-right">
                <div
                    className={`flex flex-wrap gap-1 w-full justify-end content-start rounded transition-colors ${isRefDragOver ? 'bg-stone-800 ring-2 ring-stone-600' : ''}`}
                    onClick={handleStartEdit}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsRefDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsRefDragOver(false); }}
                    onDrop={handleRefDropRef}
                >
                    {getEffectiveRefs().length > 0 ? (
                        getEffectiveRefs().slice(0, 9).map((url: string, i: number) => {
                            if (!url) return null;
                            const slot = (clip.modelInputSlots || []).find((s: any) => getMISSlotUrl(s) === url);
                            const label = slot?.studioItem?.name || slot?.media?.studioItem?.name || 'Reference';
                            return (
                                <div key={`mis-${i}`} className="w-[24px] h-[24px]">
                                    <MediaDisplay
                                        url={url}
                                        title={label}
                                        className="w-full h-full object-cover rounded shadow-sm hover:opacity-80 transition-opacity"
                                        isReference={true}
                                        contentType="auto"
                                        onUnlink={() => handleRefUnlink(url)}
                                        onPlay={(clickedUrl) => {
                                            const allUrls = getEffectiveRefs();
                                            const resultUrls = parseStringList(clip.resultUrl || '');
                                            const refItems = allUrls.map((u: string, idx: number) => ({
                                                id: u,
                                                url: u,
                                                type: (u.match(/\.(mp4|mov|webm|mkv)($|\?)/i) ? 'video' : 'image') as 'video' | 'image',
                                                title: 'Reference',
                                                isReference: true,
                                                ownerClipId: clip.id.toString()
                                            }));

                                            let fullPlaylist = [...refItems];
                                            if (resultUrls.length > 0) {
                                                const resultItems = resultUrls.map((resUrl, idx) => ({
                                                    id: `result-${clip.id}-${idx}`,
                                                    url: resUrl,
                                                    type: (resUrl.match(/\.(mp4|mov|webm|mkv)($|\?)/i) ? 'video' : 'image') as 'video' | 'image',
                                                    title: idx === 0 ? 'Latest Result' : `History ${idx}`,
                                                    isReference: false,
                                                    ownerClipId: clip.id.toString()
                                                }));
                                                fullPlaylist = [...resultItems, ...refItems];
                                            }

                                            onPlay(clickedUrl, fullPlaylist);
                                        }}
                                    />
                                </div>
                            );
                        })
                    ) : (
                        <div className="w-full h-full flex items-center justify-end text-stone-600 text-[10px] px-2 opacity-50 group-hover:opacity-100">
                            Drop Refs
                        </div>
                    )}
                </div>
            </TableCell>
        </>
    );
}
