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
import { MediaDisplay } from "@/components/media/MediaDisplay"
import { RowActions } from "@/components/ui/RowActions"
import { downloadFile, getClipFilename, getNextStatus } from "@/lib/download-utils"

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
        // removed blocking guard for 'Done' clips as per user feedback
        startEditing()
    }

    const startEditing = () => {
        // IMPORTANT: Initialize editValues with explicitRefUrls for the refImageUrls field.
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

    const handleDownload = async () => {
        if (clip.resultUrl) {
            const filename = getClipFilename(clip);
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
            const currentVal = editValues[key];
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
            <TableCell className="w-[20px] p-0 text-center align-top py-3 cursor-grab active:cursor-grabbing touch-none" {...attributes} {...listeners}>
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
            <TableCell className="align-top font-sans font-extralight text-stone-500 text-xs py-3 w-[45px]">
                {clip.scene}
            </TableCell>

            {/* ... [Title/Char/Loc/Cam/Action/Dialog Cells Omitted for Brevity - Keeping same Logic] ... 
                Actually, multi_replace_file_content would be better if I could target chunks.
                But since I'm doing a full file replace to ensure imports are clean, I must include EVERYTHING.
                I will copy the standard cells from the view.
            */}

            <TableCell className={`align-top w-[125px] ${isEditing ? "p-1" : "py-3"}`}>
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
            <TableCell className={`align-top w-[9%] ${isEditing ? "p-1" : "py-3"}`}>
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
                                        onSelect={(e) => e.preventDefault()}
                                        className="focus:bg-stone-800 focus:text-white"
                                    >
                                        {char}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {clip.character
                                ? clip.character.split(',').map((char, i) => (
                                    <div key={i} className="leading-tight truncate">{char.trim()}</div>
                                ))
                                : <span className="text-stone-500 italic">-</span>
                            }
                            {clip.characterImageUrls && clip.characterImageUrls.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {clip.characterImageUrls.map((url, i) => (
                                        <img
                                            key={i}
                                            src={url.startsWith('/api/') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
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
            <TableCell className={`align-top w-[100px] ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white">
                    {isEditing ? (
                        <div className="relative w-full">
                            <Input
                                value={editValues.location || ''}
                                onChange={(e) => handleChange('location', e.target.value)}
                                className="h-8 w-full text-xs"
                                placeholder="Location..."
                            />
                            {/* Suggestion List - Simple implementation since we lack full Combobox components */}
                            {uniqueValues.locations.length > 0 && (
                                <div className="absolute top-full left-0 w-full z-50 mt-1 max-h-40 overflow-y-auto rounded-md border border-stone-800 bg-stone-900 shadow-md">
                                    {uniqueValues.locations.filter(l => !editValues.location || l.toLowerCase().includes(editValues.location.toLowerCase())).map((opt) => (
                                        <div
                                            key={opt}
                                            className="cursor-pointer px-2 py-1.5 text-xs text-stone-200 hover:bg-stone-800 hover:text-white"
                                            onMouseDown={(e) => {
                                                e.preventDefault(); // Prevent blur
                                                handleChange('location', opt);
                                            }}
                                        >
                                            {opt}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <span className="table-text truncate block">{clip.location || '-'}</span>
                            {clip.locationImageUrls && clip.locationImageUrls.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {clip.locationImageUrls.map((url, i) => (
                                        <img
                                            key={i}
                                            src={url.startsWith('/api/') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
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
            <TableCell className={`align-top text-white text-xs w-[80px] ${isEditing ? "p-1" : "py-3"}`}>
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
                            <span className="table-text truncate block">{clip.camera || '-'}</span>
                        )}
                    </EditableCell>
                </div>
            </TableCell>
            <TableCell className={`align-top text-white w-[20%] ${isEditing ? "p-1" : "py-3"}`}>
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
            <TableCell className={`align-top text-white w-[20%] ${isEditing ? "p-1" : "py-3"}`}>
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
            <TableCell className="align-top py-3 w-[120px] text-right">
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
                        const urls = clip.explicitRefUrls ? clip.explicitRefUrls.split(',').map(s => s.trim()).filter(Boolean) : [];
                        return urls.length > 0 ? (
                            <div className="flex gap-1 justify-end" onClick={handleStartEdit}>
                                {urls.slice(0, 3).map((url, i) => (
                                    <img
                                        key={i}
                                        src={url.startsWith('/api/') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                        alt={`Ref ${i + 1}`}
                                        className="w-[40px] h-[40px] object-cover rounded border border-stone-600 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
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
                                                className="btn-icon-action w-[40px] h-[40px] p-0 opacity-50 hover:opacity-100 border-dashed border-stone-700"
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

            <TableCell className="align-top py-3 w-[110px] text-left">
                {/* RESULT Column using MediaDisplay */}
                {(clip.status === 'Done' || clip.status === 'Ready' || clip.status === 'Saved' || clip.status?.startsWith('Saved') || clip.status === 'Error') && clip.resultUrl && (
                    <div className="flex justify-start">
                        <MediaDisplay
                            url={clip.resultUrl}
                            model={clip.model}
                            onPlay={onPlay}
                            className="w-[100px] h-[56px] rounded-md overflow-hidden border border-stone-800 shadow-sm"
                        />
                    </div>
                )}
            </TableCell>

            <TableCell className="align-top text-left py-3 w-[45px] pr-12">
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
        </TableRow>
    )
}

