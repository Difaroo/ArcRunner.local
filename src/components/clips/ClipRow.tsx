import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Clip } from "@/app/api/clips/route"
import { useState } from "react"

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
    saving
}: ClipRowProps) {
    const [editValues, setEditValues] = useState<Partial<Clip>>({})

    const handleStartEdit = () => {
        setEditValues(clip)
        onEdit(clip)
    }

    const handleSave = () => {
        onSave(clip.id, editValues)
    }

    const handleChange = (field: keyof Clip, value: string) => {
        setEditValues(prev => ({ ...prev, [field]: value }))
    }

    const renderCell = (field: keyof Clip, className: string = "") => {
        if (isEditing) {
            const value = (editValues[field] as string) || ""
            const isLongField = field === 'action' || field === 'dialog'

            if (isLongField) {
                return (
                    <Textarea
                        value={value}
                        onChange={(e) => handleChange(field, e.target.value)}
                        className="min-h-[80px] text-xs"
                        onClick={(e) => e.stopPropagation()}
                    />
                )
            }
            return (
                <Input
                    value={value}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className="h-8 text-xs"
                    onClick={(e) => e.stopPropagation()}
                />
            )
        }
        return (
            <div
                onClick={handleStartEdit}
                className={`cursor-pointer hover:bg-stone-800 p-1 rounded -m-1 transition ${className} ${!clip[field] ? 'text-stone-500 italic' : ''}`}
                title="Click to edit"
            >
                {clip[field] || '-'}
            </div>
        )
    }

    return (
        <TableRow className={`group hover:bg-black transition-colors ${isSelected ? 'bg-stone-900' : ''}`}>
            <TableCell className="w-10 text-center align-top py-3">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelect(clip.id)}
                />
            </TableCell>
            <TableCell className="align-top font-mono text-stone-500 text-xs py-3">
                {clip.scene}
            </TableCell>
            <TableCell className="align-top w-1/6 py-3">
                {renderCell('title', "font-medium text-white block")}
            </TableCell>
            <TableCell className="align-top w-32 py-3">
                {renderCell('character', "text-white")}
            </TableCell>
            <TableCell className="align-top w-32 py-3">
                {renderCell('location', "text-white")}
            </TableCell>
            <TableCell className="align-top text-white text-xs w-32 py-3">
                <div className="mb-2">
                    <span className="text-stone-500 uppercase tracking-wider text-[10px] block mb-0.5 font-semibold">Style</span>
                    {renderCell('style')}
                </div>
                <div>
                    <span className="text-stone-500 uppercase tracking-wider text-[10px] block mb-0.5 font-semibold">Camera</span>
                    {renderCell('camera')}
                </div>
            </TableCell>
            <TableCell className="align-top text-white w-1/3 py-3">
                {renderCell('action', "leading-relaxed")}
            </TableCell>
            <TableCell className="align-top text-white w-1/6 py-3">
                {renderCell('dialog', "text-white")}
            </TableCell>
            <TableCell className="align-top py-3">
                {clip.refImageUrls && clip.refImageUrls.length > 5 && !clip.refImageUrls.startsWith('`') ? (
                    <div className="relative group/image">
                        <img
                            src={clip.refImageUrls.split(',')[0]}
                            alt="Ref"
                            className="w-full h-auto object-cover rounded border border-zinc-200 shadow-sm"
                            style={{ maxHeight: '60px', maxWidth: '100px' }}
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                        {clip.refImageUrls.split(',').length > 1 && (
                            <div className="absolute bottom-0 right-0 bg-zinc-900 text-white text-[10px] px-1 rounded-tl">
                                +{clip.refImageUrls.split(',').length - 1}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-16 h-10 bg-zinc-100 rounded border border-zinc-200 flex items-center justify-center text-zinc-400 text-xs">
                        -
                    </div>
                )}
            </TableCell>
            <TableCell className="align-top text-right py-3">
                {isEditing ? (
                    <div className="flex justify-end gap-2">
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={saving}
                            className="h-8 px-2 text-xs"
                        >
                            {saving ? '...' : 'Save'}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onCancelEdit}
                            className="h-8 w-8"
                        >
                            <span className="material-symbols-outlined !text-lg">close</span>
                        </Button>
                    </div>
                ) : (
                    <div className="flex justify-end gap-2">
                        {clip.status === 'Done' && clip.resultUrl && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => onPlay(clip.resultUrl!)}
                                className="h-8 w-8 border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary"
                                title="Play"
                            >
                                <span className="material-symbols-outlined !text-lg">play_arrow</span>
                            </Button>
                        )}

                        {(!clip.status || clip.status === '' || clip.status === 'Error') && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onGenerate(clip)}
                                className="h-8 px-2 text-xs"
                            >
                                Gen
                            </Button>
                        )}

                        {clip.status === 'Generating' && (
                            <Badge variant="secondary" className="animate-pulse">Gen...</Badge>
                        )}
                    </div>
                )}
            </TableCell>
        </TableRow>
    )
}
