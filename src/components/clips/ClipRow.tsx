import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Clip } from "@/app/api/clips/route"
import { useState, useEffect } from "react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"
import { ImageUploadCell } from "@/components/ui/ImageUploadCell"
import { EditableCell } from "@/components/ui/EditableCell"
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface ClipRowProps {
    clip: Clip
    isSelected: boolean
    isEditing: boolean
    onSelect: (id: string) => void
    onEdit: (clip: Clip) => void
    onSave: (id: string, values: Partial<Clip>) => void
    onCancelEdit: () => void
    onGenerate: (clip: Clip) => void
    onPlay: (url: string) => void
    saving: boolean
    uniqueValues: {
        characters: string[]
        locations: string[]
        styles: string[]
        cameras: string[]
    }
}

export function ClipRow({
    clip,
    isSelected,
    isEditing,
    onSelect,
    onEdit,
    onSave,
    onCancelEdit,
    onGenerate,
    onPlay,
    saving,
    uniqueValues
}: ClipRowProps) {
    const [editValues, setEditValues] = useState<Partial<Clip>>({})
    const [downloadCount, setDownloadCount] = useState(0)
    const [showEditGuard, setShowEditGuard] = useState(false)
    const [autoOpenUpload, setAutoOpenUpload] = useState(false)

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: clip.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: isDragging ? 'relative' as const : undefined,
    }

    const handleStartEdit = () => {
        if (clip.status === 'Done' && downloadCount === 0) {
            setShowEditGuard(true)
            return
        }
        startEditing()
    }

    const startEditing = () => {
        // IMPORTANT: Initialize editValues with explicitRefUrls for the refImageUrls field.
        // The clip.refImageUrls provided by API is a COMBINED list (Values + Library).
        // We only want to edit the Explicit values (Column Data).
        // Otherwise, we get "Zombie Images" where Library refs get hardcoded into the sheet on save.
        setEditValues({
            ...clip,
            refImageUrls: clip.explicitRefUrls || ''
        })
        onEdit(clip)
    }

    const handleSaveAndDownload = () => {
        if (clip.resultUrl) {
            onPlay(clip.resultUrl)
            setDownloadCount(prev => prev + 1)
            onSave(clip.id, { status: 'Saved' })
        }
        setShowEditGuard(false)
    }

    const handleDiscardAndEdit = () => {
        setShowEditGuard(false)
        startEditing()
    }

    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (clip.resultUrl && !isDownloading) {
            setIsDownloading(true);
            try {
                // 1. Calculate Version
                let ver = 1;
                const status = clip.status || '';
                if (status.startsWith('Saved')) {
                    const match = status.match(/Saved \[(\d+)\]/);
                    if (match) {
                        ver = parseInt(match[1]) + 1;
                    } else if (status === 'Saved') {
                        ver = 2;
                    }
                }

                // 2. Construct Filename
                const safeTitle = (clip.title || 'Untitled').replace(/[^a-z0-9 ]/gi, '');
                const scene = clip.scene || '0';

                let filename = `${scene} ${safeTitle}`;
                if (ver > 1) {
                    filename += ` ${ver.toString().padStart(2, '0')}`;
                }
                // Determine extension from URL or default to .mp4
                const ext = clip.resultUrl.split('.').pop()?.split('?')[0] || 'mp4';
                // Only append extension if not present in title (unlikely)
                if (!filename.endsWith(`.${ext}`)) {
                    filename += `.${ext}`;
                }

                // 3. Fetch Blob (Wait for it!)
                // Use proxy to avoid CORS
                const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(clip.resultUrl)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Download failed');

                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);

                // 4. Trigger Save Dialog
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Cleanup
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

                // 5. Update Status (Only on success)
                setDownloadCount(prev => prev + 1)
                const newStatus = ver > 1 ? `Saved [${ver}]` : 'Saved';
                onSave(clip.id, { status: newStatus })

            } catch (err) {
                console.error('Download error:', err);
                alert('Failed to download file.');
            } finally {
                setIsDownloading(false);
            }
        }
    }

    const handleSave = () => {
        // Only send changed fields to avoid data corruption (Zombie Images)
        // and to prevent overwriting correct data with empty defaults (Disappearing Thumbs)
        const updates: Partial<Clip> = {};

        // Helper to normalize values for comparison (treat undefined/null as empty string)
        const normalize = (val: any) => val === undefined || val === null ? '' : String(val);

        (Object.keys(editValues) as Array<keyof Clip>).forEach(key => {
            const currentVal = editValues[key];

            // Special handling for refImageUrls comparison
            let originalVal;
            if (key === 'refImageUrls') {
                originalVal = clip.explicitRefUrls;
            } else {
                originalVal = clip[key];
            }

            if (normalize(currentVal) !== normalize(originalVal)) {
                // @ts-ignore
                updates[key] = currentVal;
            }
        });

        if (Object.keys(updates).length > 0) {
            onSave(clip.id, updates);
        } else {
            // Nothing changed, just close edit mode
            onCancelEdit();
        }
    }

    const handleChange = (field: keyof Clip, value: string) => {
        setEditValues(prev => ({ ...prev, [field]: value }))
    }

    const toggleCharacter = (char: string) => {
        const current = (editValues.character || "").split(',').map(c => c.trim()).filter(Boolean);
        let next: string[];
        if (current.includes(char)) {
            next = current.filter(c => c !== char);
        } else {
            next = [...current, char];
        }
        handleChange('character', next.join(', '));
    }



    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={`group hover:bg-black transition-colors ${isSelected ? 'bg-stone-900' : ''} ${isEditing ? 'bg-black' : ''} ${isDragging ? 'opacity-50 bg-stone-800' : ''}`}
        >
            <TableCell className="w-[1px] p-0 pl-1 pr-0 align-top py-3 cursor-grab active:cursor-grabbing touch-none" {...attributes} {...listeners}>
                <div className="flex items-center justify-center h-4 w-4">
                    <span className="material-symbols-outlined text-stone-600 hover:text-stone-400 !text-base leading-none">drag_indicator</span>
                </div>
            </TableCell>
            <TableCell className="w-6 px-0 text-center align-top py-3">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelect(clip.id)}
                />
            </TableCell>
            <TableCell className="align-top font-sans font-extralight text-stone-500 text-xs py-3">
                {clip.scene}
            </TableCell>
            <TableCell className={`align-top w-[13%] ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="font-medium text-white block">
                    {isEditing ? (
                        <Input
                            value={editValues.title || ''}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className="table-input h-full"
                        />
                    ) : (
                        <span className="table-text font-medium">{clip.title || '-'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top w-16 ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white whitespace-pre-line text-xs font-sans font-extralight">
                    {isEditing ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-full min-h-[32px] w-full justify-start text-xs text-left whitespace-normal">
                                    {editValues.character || "Select..."}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 max-h-60 overflow-y-auto bg-stone-900 border-stone-800 text-white">
                                {uniqueValues.characters.map((char) => (
                                    <DropdownMenuCheckboxItem
                                        key={char}
                                        checked={(editValues.character || "").split(',').map(c => c.trim()).includes(char)}
                                        onCheckedChange={() => toggleCharacter(char)}
                                        className="focus:bg-stone-800 focus:text-white"
                                    >
                                        {char}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        clip.character
                            ? clip.character.split(',').map((char, i) => (
                                <div key={i} className="leading-tight">{char.trim()}</div>
                            ))
                            : <span className="text-stone-500 italic">-</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top w-32 ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white">
                    {isEditing ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs text-left truncate">
                                    {editValues.location || "Select..."}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto bg-stone-900 border-stone-800 text-white">
                                {uniqueValues.locations.map((opt) => (
                                    <DropdownMenuItem
                                        key={opt}
                                        onClick={() => handleChange('location', opt)}
                                        className="focus:bg-stone-800 focus:text-white"
                                    >
                                        {opt}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <span className="table-text">{clip.location || '-'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top text-white text-xs w-32 ${isEditing ? "p-1" : "py-3"}`}>
                <div>
                    <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit}>
                        {isEditing ? (
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
                        ) : (
                            <span className="table-text">{clip.camera || '-'}</span>
                        )}
                    </EditableCell>
                </div>
            </TableCell>
            <TableCell className={`align-top text-white w-1/4 ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="leading-relaxed">
                    {isEditing ? (
                        <AutoResizeTextarea
                            value={editValues.action || ''}
                            onChange={(e) => handleChange('action', e.target.value)}
                            className="min-h-[80px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-extralight leading-relaxed"
                        />
                    ) : (
                        <span className="table-text">{clip.action || '-'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top text-white w-1/6 ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white">
                    {isEditing ? (
                        <AutoResizeTextarea
                            value={editValues.dialog || ''}
                            onChange={(e) => handleChange('dialog', e.target.value)}
                            className="min-h-[80px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-extralight leading-relaxed"
                        />
                    ) : (
                        <span className="table-text">{clip.dialog || '-'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className="align-top py-3 w-auto">
                {isEditing ? (
                    <div className="flex flex-col gap-2">
                        {/* Show Library Images (Static/ReadOnly) to prevent them "disappearing" during edit */}
                        {(() => {
                            const explicitSet = new Set((clip.explicitRefUrls || '').split(',').map(s => s.trim()).filter(Boolean));
                            const allUrls = (clip.refImageUrls || '').split(',').map(s => s.trim()).filter(Boolean);
                            const libraryOnlyUrls = allUrls.filter(url => !explicitSet.has(url));

                            if (libraryOnlyUrls.length === 0) return null;

                            return (
                                <div className="flex gap-1 opacity-70" title="Reference from Library (Linked)">
                                    {libraryOnlyUrls.slice(0, 3).map((url, i) => (
                                        <img
                                            key={`lib-${i}`}
                                            src={url.startsWith('/api/') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                            alt={`Library Ref ${i + 1}`}
                                            className="w-[50px] h-[50px] object-cover rounded border border-blue-900/50 shadow-sm"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ))}
                                </div>
                            );
                        })()}

                        <ImageUploadCell
                            value={editValues.refImageUrls || ''}
                            onChange={(url) => handleChange('refImageUrls', url)}
                            isEditing={true}
                            autoOpen={autoOpenUpload}
                            onAutoOpenComplete={() => setAutoOpenUpload(false)}
                            episode={clip.episode}
                        />
                    </div>
                ) : (
                    (() => {
                        const urls = clip.refImageUrls ? clip.refImageUrls.split(',').map(s => s.trim()).filter(Boolean) : [];
                        return urls.length > 0 ? (
                            <div className="flex gap-1" onClick={handleStartEdit}>
                                {urls.slice(0, 3).map((url, i) => (
                                    <img
                                        key={i}
                                        src={url.startsWith('/api/') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                        alt={`Ref ${i + 1}`}
                                        className="w-[50px] h-[50px] object-cover rounded border border-black shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="w-full">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setAutoOpenUpload(true);
                                                    handleStartEdit();
                                                }}
                                                className="btn-icon-action w-full"
                                            >
                                                <span className="material-symbols-outlined !text-lg">add</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Add Reference Image</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        );
                    })()
                )}
            </TableCell>
            <TableCell className="align-top text-right py-3">
                {isEditing ? (
                    <div className="flex justify-end gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="h-8 w-8 border-[0.5px] border-green-600/50 text-green-600 hover:bg-green-600/10 hover:text-green-600 hover:border-green-600"
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined !text-lg">check</span>}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Save changes</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={onCancelEdit}
                                        className="btn-icon-action h-8 w-8"
                                    >
                                        <span className="material-symbols-outlined !text-lg">close</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Cancel editing</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                ) : (
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex justify-end gap-2">
                            {(clip.status === 'Done' || clip.status === 'Ready' || clip.status === 'Saved' || clip.status?.startsWith('Saved')) && clip.resultUrl && (
                                <div className="flex gap-2">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => onPlay(clip.resultUrl!)}
                                                    className="btn-icon-action h-8 w-8"
                                                >
                                                    <span className="material-symbols-outlined !text-lg">play_arrow</span>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Play video</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={handleDownload}
                                                    disabled={saving || !clip.resultUrl || isDownloading}
                                                    className={`btn-icon-action h-8 w-8 ${!clip.resultUrl ? 'opacity-30' : ''}`}
                                                >
                                                    {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined !text-lg">download</span>}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Download video</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            )}

                            {(!clip.status || clip.status === '' || clip.status === 'Error' || ((clip.status === 'Done' || clip.status === 'Ready' || clip.status === 'Saved' || clip.status?.startsWith('Saved')) && !clip.resultUrl)) && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                onClick={() => onGenerate(clip)}
                                                className="h-8 px-3 text-xs border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary font-normal border-[0.5px]"
                                            >
                                                GEN
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Generate video for this clip</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}

                            {clip.status === 'Generating' && (
                                <Button
                                    variant="outline"
                                    disabled
                                    className="h-8 w-8 p-0 border-primary/50 bg-primary/10"
                                >
                                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                </Button>
                            )}
                        </div>

                        {/* Status Readout */}
                        <div className="text-[10px] text-stone-500 font-medium h-4 flex items-center justify-end">
                            {(clip.status === 'Done' || clip.status === 'Ready' || clip.status === 'Saved' || clip.status?.startsWith('Saved')) && clip.resultUrl && (
                                (downloadCount > 0 || clip.status === 'Saved' || clip.status?.startsWith('Saved')) ? (
                                    <span className="text-stone-500 flex items-center gap-1">
                                        {clip.status?.startsWith('Saved') ? clip.status : `Saved${downloadCount > 1 ? ` [${downloadCount}]` : ''}`}
                                    </span>
                                ) : (
                                    <span className="text-primary/80">
                                        Ready
                                    </span>
                                )
                            )}
                            {clip.status === 'Generating' && (
                                <span className="text-primary/70">Generating...</span>
                            )}
                            {clip.status === 'Error' && (
                                <span className="text-destructive">Error</span>
                            )}
                        </div>
                    </div>
                )}
            </TableCell>
            <AlertDialog open={showEditGuard} onOpenChange={setShowEditGuard}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unsaved Clip</AlertDialogTitle>
                        <AlertDialogDescription>
                            This clip has not been saved. Save now, or discard the clip?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleDiscardAndEdit}>Discard</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSaveAndDownload}>Save</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </TableRow>
    )
}
