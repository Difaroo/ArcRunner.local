import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Clip } from "@/types"
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
import { MediaDisplay } from "@/components/media/MediaDisplay"
import { RowActions } from "@/components/ui/RowActions"
import { downloadFile, getClipFilename, getNextStatus } from "@/lib/download-utils"
import { useClickOutside } from "@/hooks/useClickOutside"
import { useRowShortcuts } from "@/hooks/useRowShortcuts"
import React from "react"

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
    onDelete: (id: string) => void
    onDuplicate: (id: string) => void
    onResolveImage?: (name: string) => string | undefined
    seriesTitle: string
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
    uniqueValues,
    onDelete,
    onDuplicate,
    onResolveImage,
    seriesTitle
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

    // Helper to filter out auto-resolved images (Char/Loc) from the Explicit list
    const getCleanExplicitRefs = () => {
        const rawExplicit = clip.explicitRefUrls || clip.refImageUrls || ''; // Fallback to refImageUrls if explicit missing
        const urls = rawExplicit.split(',').map(s => s.trim()).filter(Boolean);

        // Block List: Character and Location Images
        const autoImages = new Set([
            ...(clip.characterImageUrls || []),
            ...(clip.locationImageUrls || [])
        ]);

        return urls.filter(u => !autoImages.has(u));
    };

    const handleStartEdit = () => {
        // removed blocking guard for 'Done' clips as per user feedback
        startEditing()
    }

    const startEditing = () => {
        // IMPORTANT: Initialize editValues with explicit keys to ensure tracking works
        // We do NOT filter here, to prevent data loss. Filtering is visual only (View mode).

        setEditValues({
            ...clip,
            negativePrompt: clip.negativePrompt || '',
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

    // --- CLICK OUTSIDE TO CANCEL ---
    // User requested removal of Click Outside logic in favor of shortcuts (Cmd+.)
    // to prevent accidental closing when interacting with complex menus.
    // Explicit 'onCancel' or 'Cmd+.' should be used.

    // We retain setNodeRef for dnd-kit but remove the custom domRef logic.
    // --- CLICK OUTSIDE TO CANCEL ---
    // User requested removal of Click Outside logic in favor of shortcuts (Cmd+.)
    // to prevent accidental closing when interacting with complex menus.
    // Explicit 'onCancel' or 'Cmd+.' should be used.

    // We retain setNodeRef for dnd-kit from top of function.

    // We can just use setNodeRef directly on the TableRow now. 

    // We can just use setNodeRef directly on the TableRow now.


    // --- DELETE LOGIC ---
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const handleDeleteClick = () => {
        setShowDeleteDialog(true);
    };

    const confirmDelete = async () => {
        try {
            const res = await fetch('/api/clips', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: clip.id })
            });

            if (!res.ok) throw new Error('Failed to delete');

            // Notify Parent to remove from list (Needs a new prop or just refresh?)
            // Parent ClipTable uses clips state. It needs to know.
            // We probably need an onDelete prop passed down from Page -> Table -> Row.
            // Or trigger a refresh.
            // Let's call a prop.
            if (onDelete) onDelete(clip.id);

        } catch (e) {
            console.error('Delete failed', e);
            alert('Failed to delete clip');
        } finally {
            setShowDeleteDialog(false);
        }
    };


    const handleDownload = async () => {
        if (clip.resultUrl) {
            const filename = getClipFilename(clip, seriesTitle);
            const success = await downloadFile(clip.resultUrl, filename);

            if (success) {
                setDownloadCount(prev => prev + 1)
                const newStatus = getNextStatus(clip.status || '');
                onSave(clip.id, { status: newStatus })
            }
        }
    }

    const handleSave = () => {
        const updates: Partial<Clip> = {};
        const normalize = (val: any) => val === undefined || val === null ? '' : String(val);

        (Object.keys(editValues) as Array<keyof Clip>).forEach(key => {
            // EXCLUDE SYSTEM FIELDS from being overwritten by potentially stale local state
            if (['resultUrl', 'status', 'taskId', 'thumbnailPath', 'createdAt', 'updatedAt'].includes(key as string)) {
                return;
            }

            const currentVal = editValues[key];
            let originalVal;
            // Explicitly map refImageUrls key back to the 'explicitRefUrls' source of truth
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

    useRowShortcuts({
        isEditing,
        onSave: handleSave,
        onDuplicate: () => onDuplicate(clip.id),
        onDelete: handleDeleteClick,
        onCancel: onCancelEdit
    });

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={`group hover:bg-black transition-colors ${isSelected ? 'bg-stone-900' : ''} ${isEditing ? 'bg-black' : ''} ${isDragging ? 'opacity-50 bg-stone-800' : ''}`}
            data-testid="clip-row"
        >
            <TableCell className="w-[10px] p-0 text-center align-top py-3 cursor-grab active:cursor-grabbing touch-none" {...attributes} {...listeners}>
                <div className="flex items-center justify-center h-4 w-4">
                    <span className="material-symbols-outlined text-stone-600 hover:text-stone-400 !text-base leading-none">drag_indicator</span>
                </div>
            </TableCell>
            <TableCell className="w-[28px] px-0 text-center align-top py-3">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelect(clip.id)}
                />
            </TableCell>
            <TableCell className="align-top font-sans font-extralight text-stone-500 text-xs py-3 w-[24px] px-1">
                {clip.scene}
            </TableCell>

            {/* ... [Title/Char/Loc/Cam/Action/Dialog Cells Omitted for Brevity - Keeping same Logic] ... 
                Actually, multi_replace_file_content would be better if I could target chunks.
                But since I'm doing a full file replace to ensure imports are clean, I must include EVERYTHING.
                I will copy the standard cells from the view.
            */}

            <TableCell className={`align-top w-[160px] ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="font-medium text-white block">
                    {isEditing ? (
                        <Input
                            value={editValues.title || ''}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className="table-input h-full"
                        />
                    ) : (
                        <span className="table-text font-medium">{clip.title || '+'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top w-[170px] ${isEditing ? "p-1" : "py-3"}`} data-testid="cell-character">
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white whitespace-pre-line text-xs font-sans font-extralight">
                    {isEditing ? (
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
                                                checked={(editValues.character || "").split(',').map(c => c.trim()).includes(char)}
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
                            {/* Edit Mode Preview */}
                            {isEditing && onResolveImage ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {(editValues.character || "").split(',').map(c => c.trim()).filter(Boolean).map((char, i) => {
                                        const url = onResolveImage(char);
                                        if (!url) return null;
                                        return (
                                            <img
                                                key={`${char}-${i}`}
                                                src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                                alt={char}
                                                className="w-[32px] h-[32px] object-cover rounded border border-white/10 shadow-sm opacity-50"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                title={char}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                /* Fallback to existing static Preview if no resolver */
                                clip.characterImageUrls && clip.characterImageUrls.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1 opacity-50">
                                        {clip.characterImageUrls.map((url, i) => (
                                            <img
                                                key={i}
                                                src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                                alt="Char Prev"
                                                className="w-[32px] h-[32px] object-cover rounded border border-white/10 shadow-sm"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {clip.character
                                ? clip.character.split(',').map((char, i, arr) => (
                                    <div key={i} className="leading-tight truncate">{char.trim()}{i < arr.length - 1 ? ',' : ''}</div>
                                ))
                                : <span className="text-stone-500 italic">+</span>
                            }
                            {clip.characterImageUrls && clip.characterImageUrls.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {clip.characterImageUrls.map((url, i) => (
                                        <img
                                            key={i}
                                            src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                            alt="Char Ref"
                                            className="w-[40px] h-[40px] object-cover rounded border border-white/10 shadow-sm"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top w-[170px] ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white">
                    {isEditing ? (
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
                    ) : (
                        <div className="flex flex-col gap-2">
                            <span className="table-text truncate block">{clip.location || '+'}</span>
                            {clip.locationImageUrls && clip.locationImageUrls.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {clip.locationImageUrls.map((url, i) => (
                                        <img
                                            key={i}
                                            src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                            alt="Loc Ref"
                                            className="w-[40px] h-[40px] object-cover rounded border border-white/10 shadow-sm"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top text-white text-xs w-[140px] ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit}>
                    {isEditing ? (
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

                            {/* NEGATIVE PROMPT (NEGATE) */}
                            <div className="space-y-1">
                                <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">NEGATE</span>
                                <AutoResizeTextarea
                                    value={editValues.negativePrompt || ''}
                                    onChange={(e) => handleChange('negativePrompt', e.target.value)}
                                    className="min-h-[40px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-normal leading-relaxed placeholder:text-zinc-600"
                                    placeholder="No blur, distortions..."
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1 w-full h-full">
                            <span className="table-text truncate block">{clip.camera || '+'}</span>
                            {clip.negativePrompt ? (
                                <div className="flex flex-col gap-0 mt-2">
                                    <span className="font-semibold text-stone-500 text-[10px] tracking-wider uppercase">NEGATE</span>
                                    <span className="table-text">{clip.negativePrompt}</span>
                                </div>
                            ) : null}
                        </div>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top text-white w-[15%] ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="leading-relaxed">
                    {isEditing ? (
                        <AutoResizeTextarea
                            value={editValues.action || ''}
                            onChange={(e) => handleChange('action', e.target.value)}
                            className="min-h-[80px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-extralight leading-relaxed"
                        />
                    ) : (
                        <span className="table-text whitespace-pre-wrap">{clip.action || '+'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top text-white w-[15%] ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white">
                    {isEditing ? (
                        <AutoResizeTextarea
                            value={editValues.dialog || ''}
                            onChange={(e) => handleChange('dialog', e.target.value)}
                            className="min-h-[80px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-extralight leading-relaxed"
                        />
                    ) : (
                        <span className="table-text whitespace-pre-wrap">{clip.dialog || '+'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className="align-top py-3 w-[80px] text-right">
                {isEditing ? (
                    <div className="flex flex-col gap-2 items-end">
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
                        const urls = getCleanExplicitRefs();
                        return urls.length > 0 ? (
                            <div className="flex gap-1 justify-end" onClick={handleStartEdit}>
                                {urls.slice(0, 3).map((url, i) => (
                                    <img
                                        key={i}
                                        src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                        alt={`Ref ${i + 1}`}
                                        className="w-[24px] h-[24px] object-cover rounded border border-stone-600 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="w-full flex justify-end">
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
                                                className="btn-icon-action w-[24px] h-[24px] p-0 opacity-50 hover:opacity-100 border-dashed border-stone-700"
                                            >
                                                <span className="material-symbols-outlined !text-lg text-primary">add</span>
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

            {/* --- REFACTOR START: SHARED COMPONENTS --- */}

            <TableCell className="align-top py-3 w-[80px] text-left">
                {/* RESULT Column using MediaDisplay */}
                {(clip.status === 'Done' || clip.status === 'Ready' || clip.status === 'Saved' || clip.status?.startsWith('Saved') || clip.status?.startsWith('Error')) && clip.resultUrl && (
                    <div className={`flex justify-start relative ${clip.status?.startsWith('Error') ? 'opacity-50 grayscale border-red-500 border-2 rounded-md' : ''}`}>
                        {/* Visual Warning for Stale/Error State */}
                        {clip.status?.startsWith('Error') && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                <span className="material-symbols-outlined text-red-500 bg-black/50 rounded-full p-1">warning</span>
                            </div>
                        )}
                        <MediaDisplay
                            url={clip.resultUrl}
                            originalUrl={clip.resultUrl}
                            model={clip.model}
                            title={getClipFilename(clip, seriesTitle).replace(/\.[^/.]+$/, "")}
                            onPlay={onPlay}
                            className="w-[70px] max-h-[70px] aspect-square object-cover rounded-md overflow-hidden border border-stone-800 shadow-sm"
                        />
                    </div>
                )}
            </TableCell>

            <TableCell className="align-top text-left py-3 w-[40px] px-1">
                {/* ACTION Column using RowActions */}
                <RowActions
                    status={clip.status || ''}
                    resultUrl={clip.resultUrl}
                    isEditing={isEditing}
                    isSaving={saving}
                    onEditStart={() => { }} // Not used explicitly for start, as start is implicit click
                    onEditSave={handleSave}
                    onEditCancel={onCancelEdit}
                    onGenerate={() => onGenerate(clip)}
                    onDownload={handleDownload}
                    onDelete={handleDeleteClick}
                    onDuplicate={() => onDuplicate(clip.id)}
                    className="items-center"
                    data-testid="row-actions"
                />
            </TableCell>

            {/* --- REFACTOR END --- */}

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

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="border-destructive/50 bg-stone-900 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Clip?</AlertDialogTitle>
                        <AlertDialogDescription className="text-stone-400">
                            Are you sure you want to delete this clip? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row items-center justify-end gap-2">
                        <Button variant="ghost" onClick={confirmDelete} className="text-stone-400 hover:text-destructive hover:bg-destructive/10">Delete</Button>
                        <Button variant="default" onClick={() => setShowDeleteDialog(false)} className="bg-white text-black hover:bg-stone-200">Cancel</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </TableRow >
    )
}

