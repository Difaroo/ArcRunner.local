import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea"
import { ImageUploadCell } from "@/components/ui/ImageUploadCell"
import { EditableCell } from "@/components/ui/EditableCell"
import { TableCell } from "@/components/ui/table"
import { Clip } from "@/types"
import { parseStringList } from '@/lib/utils/string-helpers'
import React from "react"

export interface ClipRowEditCellsProps {
    clip: Clip;
    editValues: Partial<Clip>;
    handleChange: (field: keyof Clip, value: string) => void;
    uniqueValues: {
        characters: string[]
        locations: string[]
        styles: string[]
        cameras: string[]
    };
    toggleCharacter: (char: string) => void;
    onResolveImage?: (name: string) => string | undefined;
    onStudioAssetClick?: (name: string, type: 'CHARACTER' | 'LOCATION') => void;
    getEffectiveRefs: () => string[];
    onAddReference?: (clipId: string, url: string, type: 'IMAGE' | 'VIDEO') => Promise<void>;
    handleRefUnlink: (url: string) => void;
    autoOpenUpload: boolean;
    setAutoOpenUpload: (open: boolean) => void;
    handleStartEdit: () => void;
}

export function ClipRowEditCells({
    clip,
    editValues,
    handleChange,
    uniqueValues,
    toggleCharacter,
    onResolveImage,
    onStudioAssetClick,
    getEffectiveRefs,
    onAddReference,
    handleRefUnlink,
    autoOpenUpload,
    setAutoOpenUpload,
    handleStartEdit
}: ClipRowEditCellsProps) {
    return (
        <>
            <TableCell className={`align-top font-sans font-extralight text-stone-500 text-xs w-[35px] px-1 py-3`}>
                <EditableCell isEditing={true} onStartEdit={handleStartEdit} className="text-stone-500">
                    <Input
                        value={editValues.scene || ''}
                        onChange={(e) => handleChange('scene', e.target.value)}
                        className="h-8 w-full text-xs px-1 text-center bg-stone-900 border-stone-700 text-stone-500 font-sans disabled:opacity-50"
                    />
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top w-[160px] py-3`}>
                <EditableCell isEditing={true} onStartEdit={handleStartEdit} className="font-medium text-white block">
                    <Input
                        value={editValues.title || ''}
                        onChange={(e) => handleChange('title', e.target.value)}
                        className="h-8 w-full text-xs bg-stone-900 border-stone-700 text-white font-normal px-2 placeholder:text-stone-600"
                    />
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top w-[170px] py-3`} data-testid="cell-character">
                <EditableCell isEditing={true} onStartEdit={handleStartEdit} className="text-white whitespace-pre-line text-xs font-sans font-extralight">
                    <div className="w-full">
                        <div className="relative w-full flex items-center gap-1">
                            <Input
                                value={editValues.character || ''}
                                onChange={(e) => handleChange('character', e.target.value)}
                                className="h-full min-h-[32px] w-full text-xs"
                                placeholder="Characters..."
                            />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                        <span className="material-symbols-outlined !text-sm">expand_more</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 max-h-60 overflow-y-auto bg-stone-900 border-stone-800 text-white">
                                    {uniqueValues.characters.map((char) => (
                                        <DropdownMenuCheckboxItem
                                            key={char}
                                            checked={parseStringList(editValues.character || "").includes(char)}
                                            onCheckedChange={() => toggleCharacter(char)}
                                            onSelect={(e) => e.preventDefault()}
                                            className="focus:bg-stone-800 focus:text-white"
                                        >
                                            {char}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        {onResolveImage && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {(editValues.character ? parseStringList(editValues.character) : []).map((char, i) => {
                                    const url = onResolveImage?.(char);
                                    if (!url) return null;
                                    return (
                                        <img
                                            key={`${char}-${i}`}
                                            src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                            alt={char}
                                            className="w-[40px] h-[40px] object-cover rounded border border-white/10 shadow-sm cursor-pointer hover:opacity-75 transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onStudioAssetClick?.(char, 'CHARACTER');
                                            }}
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            title={char}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top w-[170px] py-3`}>
                <EditableCell isEditing={true} onStartEdit={handleStartEdit} className="text-white">
                    <div className="w-full">
                        <div className="relative w-full flex items-center gap-1">
                            <Input
                                value={editValues.location || ''}
                                onChange={(e) => handleChange('location', e.target.value)}
                                className="h-8 w-full text-xs"
                                placeholder="Location..."
                            />
                            {uniqueValues.locations.length > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                            <span className="material-symbols-outlined !text-sm">expand_more</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56 max-h-60 overflow-y-auto bg-stone-900 border-stone-800 text-white">
                                        {uniqueValues.locations.map((loc) => (
                                            <DropdownMenuItem
                                                key={loc}
                                                onClick={() => handleChange('location', loc)}
                                                className="focus:bg-stone-800 focus:text-white cursor-pointer"
                                            >
                                                {loc}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                        {onResolveImage && (editValues.location || "").trim().length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {(() => {
                                    const locName = (editValues.location || "").trim();
                                    const url = onResolveImage(locName);
                                    if (!url) return null;
                                    return (
                                        <img
                                            key={locName}
                                            src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                            alt={locName}
                                            className="w-[32px] h-[32px] object-cover rounded border border-white/10 shadow-sm opacity-50"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            title={locName}
                                        />
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top text-white text-xs w-[140px] py-3`}>
                <EditableCell isEditing={true} onStartEdit={handleStartEdit}>
                    <div className="flex flex-col gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs text-left truncate">
                                    {editValues.camera || "Select..."}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto bg-stone-900 border-stone-800 text-white">
                                {uniqueValues.cameras.map((opt) => (
                                    <DropdownMenuItem
                                        key={opt}
                                        onClick={() => handleChange('camera', opt)}
                                        className="focus:bg-stone-800 focus:text-white"
                                    >
                                        {opt}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">NEGATE</span>
                            <AutoResizeTextarea
                                value={editValues.negativePrompt || ''}
                                onChange={(e) => handleChange('negativePrompt', e.target.value)}
                                className="min-h-[40px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-normal leading-relaxed placeholder:text-zinc-600"
                                placeholder="No blur, distortions..."
                            />
                        </div>
                    </div>
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top text-white w-[15%] py-3`}>
                <EditableCell isEditing={true} onStartEdit={handleStartEdit} className="leading-relaxed">
                    <AutoResizeTextarea
                        value={editValues.action || ''}
                        onChange={(e) => handleChange('action', e.target.value)}
                        className="min-h-[80px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-thin leading-relaxed"
                    />
                </EditableCell>
            </TableCell>

            <TableCell className={`align-top text-white w-[15%] py-3`}>
                <EditableCell isEditing={true} onStartEdit={handleStartEdit} className="text-white">
                    <AutoResizeTextarea
                        value={editValues.dialog || ''}
                        onChange={(e) => handleChange('dialog', e.target.value)}
                        className="min-h-[80px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-thin leading-relaxed"
                    />
                </EditableCell>
            </TableCell>

            <TableCell className="align-top py-3 w-[80px] text-right">
                <div className="flex flex-col gap-2 w-full">
                    <ImageUploadCell
                        value={getEffectiveRefs().join(',')}
                        onChange={(url) => {
                            if (onAddReference) onAddReference(clip.id, url, 'IMAGE');
                        }}
                        onRemove={(url) => handleRefUnlink(url)}
                        isEditing={true}
                        autoOpen={autoOpenUpload}
                        onAutoOpenComplete={() => setAutoOpenUpload(false)}
                        episode={clip.episode}
                    />
                </div>
            </TableCell>
        </>
    );
}
