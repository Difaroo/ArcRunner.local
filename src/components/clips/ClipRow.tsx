import { Button } from "@/components/ui/button"
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

    const handleStartEdit = () => {
        if (clip.status === 'Done' && downloadCount === 0) {
            setShowEditGuard(true)
            return
        }
        startEditing()
    }

    const startEditing = () => {
        setEditValues(clip)
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

    const handleDownload = () => {
        if (clip.resultUrl) {
            onPlay(clip.resultUrl)
            setDownloadCount(prev => prev + 1)
            onSave(clip.id, { status: 'Saved' })
        }
    }

    const handleSave = () => {
        onSave(clip.id, editValues)
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
        <TableRow className={`group hover:bg-black transition-colors ${isSelected ? 'bg-stone-900' : ''}`}>
            <TableCell className="w-10 text-center align-top py-3">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelect(clip.id)}
                />
            </TableCell>
            <TableCell className="align-top font-sans font-extralight text-stone-500 text-xs py-3">
                {clip.scene}
            </TableCell>
            <TableCell className="align-top w-[13%] py-3">
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="font-medium text-white block">
                    {isEditing ? (
                        <Input
                            value={editValues.title || ''}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className="table-input"
                        />
                    ) : (
                        <span className="table-text font-medium">{clip.title || '-'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className="align-top w-16 py-3">
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white whitespace-pre-line text-xs font-sans font-extralight">
                    {isEditing ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-auto min-h-[32px] w-full justify-start text-xs text-left whitespace-normal">
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
            <TableCell className="align-top w-32 py-3">
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
            <TableCell className="align-top text-white text-xs w-32 py-3">
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
            <TableCell className="align-top text-white w-1/4 py-3">
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="leading-relaxed">
                    {isEditing ? (
                        <Textarea
                            value={editValues.action || ''}
                            onChange={(e) => handleChange('action', e.target.value)}
                            className="min-h-[80px] text-xs bg-stone-900 border-stone-700 text-white"
                        />
                    ) : (
                        <span className="table-text">{clip.action || '-'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className="align-top text-white w-1/6 py-3">
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white">
                    {isEditing ? (
                        <Textarea
                            value={editValues.dialog || ''}
                            onChange={(e) => handleChange('dialog', e.target.value)}
                            className="min-h-[80px] text-xs bg-stone-900 border-stone-700 text-white"
                        />
                    ) : (
                        <span className="table-text">{clip.dialog || '-'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className="align-top py-3 w-auto">
                {isEditing ? (
                    <ImageUploadCell
                        value={editValues.refImageUrls || ''}
                        onChange={(url) => handleChange('refImageUrls', url)}
                        isEditing={true}
                    />
                ) : (
                    (() => {
                        const urls = clip.refImageUrls ? clip.refImageUrls.split(',').map(s => s.trim()).filter(Boolean) : [];
                        return urls.length > 0 ? (
                            <div className="flex gap-1" onClick={handleStartEdit}>
                                {urls.slice(0, 3).map((url, i) => (
                                    <img
                                        key={i}
                                        src={url.startsWith('/api/images') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEdit();
                                    }}
                                    className="h-8 w-full border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary"
                                    title="Add Reference Image"
                                >
                                    <span className="material-symbols-outlined !text-lg">add</span>
                                </Button>
                            </div>
                        );
                    })()
                )}
            </TableCell>
            <TableCell className="align-top text-right py-3">
                {isEditing ? (
                    <div className="flex justify-end gap-2">
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={saving}
                            className="h-8 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                        >
                            {saving ? '...' : 'Save'}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onCancelEdit}
                            className="btn-icon-action h-8 w-8"
                        >
                            <span className="material-symbols-outlined !text-lg">close</span>
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex justify-end gap-2">
                            {(clip.status === 'Done' || clip.status === 'Ready' || clip.status === 'Saved' || clip.status?.startsWith('Saved')) && clip.resultUrl && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => onPlay(clip.resultUrl!)}
                                        className="btn-icon-action h-8 w-8"
                                        title="Play"
                                    >
                                        <span className="material-symbols-outlined !text-lg">play_arrow</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleDownload}
                                        className="btn-icon-action h-8 w-8"
                                        title="Download"
                                    >
                                        <span className="material-symbols-outlined !text-lg">download</span>
                                    </Button>
                                </div>
                            )}

                            {(!clip.status || clip.status === '' || clip.status === 'Error' || ((clip.status === 'Done' || clip.status === 'Ready' || clip.status === 'Saved' || clip.status?.startsWith('Saved')) && !clip.resultUrl)) && (
                                <Button
                                    variant="outline"
                                    onClick={() => onGenerate(clip)}
                                    className="h-8 px-3 text-xs border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary font-normal"
                                >
                                    GEN
                                </Button>
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
