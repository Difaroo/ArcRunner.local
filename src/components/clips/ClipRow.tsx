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
    const [downloaded, setDownloaded] = useState(false)

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

    const renderCell = (field: keyof Clip, className: string = "") => {
        if (isEditing) {
            const value = (editValues[field] as string) || ""

            // Character: Multi-select Menu
            if (field === 'character') {
                const selectedChars = value.split(',').map(c => c.trim()).filter(Boolean);
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-auto min-h-[32px] w-full justify-start text-xs text-left whitespace-normal">
                                {value || "Select..."}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 max-h-60 overflow-y-auto bg-stone-900 border-stone-800 text-white">
                            {uniqueValues.characters.map((char) => (
                                <DropdownMenuCheckboxItem
                                    key={char}
                                    checked={selectedChars.includes(char)}
                                    onCheckedChange={() => toggleCharacter(char)}
                                    className="focus:bg-stone-800 focus:text-white"
                                >
                                    {char}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            }

            // Location, Style, Camera: Single-select Menu
            if (['location', 'style', 'camera'].includes(field)) {
                const options = field === 'location' ? uniqueValues.locations :
                    field === 'style' ? uniqueValues.styles :
                        uniqueValues.cameras;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs text-left truncate">
                                {value || "Select..."}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto bg-stone-900 border-stone-800 text-white">
                            {options.map((opt) => (
                                <DropdownMenuItem
                                    key={opt}
                                    onClick={() => handleChange(field, opt)}
                                    className="focus:bg-stone-800 focus:text-white"
                                >
                                    {opt}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            }

            const isLongField = field === 'action' || field === 'dialog'

            if (isLongField) {
                return (
                    <Textarea
                        value={value}
                        onChange={(e) => handleChange(field, e.target.value)}
                        className="min-h-[80px] text-xs bg-stone-900 border-stone-700 text-white"
                        onClick={(e) => e.stopPropagation()}
                    />
                )
            }
            return (
                <Input
                    value={value}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className="h-8 text-xs bg-stone-900 border-stone-700 text-white"
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
                {field === 'character' && clip[field]
                    ? clip[field]!.split(',').map((char, i) => (
                        <div key={i} className="leading-tight">{char.trim()}</div>
                    ))
                    : (clip[field] || '-')}
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
            <TableCell className="align-top font-sans text-stone-500 text-xs py-3">
                {clip.scene}
            </TableCell>
            <TableCell className="align-top w-[13%] py-3">
                {renderCell('title', "font-medium text-white block")}
            </TableCell>
            <TableCell className="align-top w-16 py-3">
                {renderCell('character', "text-white whitespace-pre-line")}
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
            <TableCell className="align-top text-white w-1/4 py-3">
                {renderCell('action', "leading-relaxed")}
            </TableCell>
            <TableCell className="align-top text-white w-1/6 py-3">
                {renderCell('dialog', "text-white")}
            </TableCell>
            <TableCell className="align-top py-3">
                {clip.refImageUrls && clip.refImageUrls.length > 5 && !clip.refImageUrls.startsWith('`') ? (
                    <div className="flex gap-1">
                        {clip.refImageUrls.split(',').slice(0, 3).map((url, i) => (
                            <img
                                key={i}
                                src={`/api/proxy-image?url=${encodeURIComponent(url)}`}
                                alt={`Ref ${i + 1}`}
                                className="w-16 h-10 object-cover rounded border border-white/10 shadow-sm"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="w-16 h-10 bg-transparent rounded border border-white/10 flex items-center justify-center text-stone-500 text-xs">
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
                            className="h-8 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                        >
                            {saving ? '...' : 'Save'}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onCancelEdit}
                            className="h-8 w-8 border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary"
                        >
                            <span className="material-symbols-outlined !text-lg">close</span>
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-end gap-2">
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
                                    className="h-8 px-2 text-xs border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary"
                                >
                                    Gen
                                </Button>
                            )}

                            {clip.status === 'Generating' && (
                                <Badge variant="secondary" className="animate-pulse bg-primary/20 text-primary border-primary/50">Gen...</Badge>
                            )}
                        </div>

                        {/* Status Readout */}
                        {clip.status === 'Done' && (
                            <div className="text-[10px] text-stone-500 font-medium">
                                {downloaded ? (
                                    <span className="text-green-500 flex items-center gap-1">
                                        <span className="material-symbols-outlined !text-[10px]">check</span>
                                        Downloaded
                                    </span>
                                ) : (
                                    <span className="text-primary/80 cursor-pointer hover:text-primary" onClick={() => setDownloaded(true)}>
                                        Ready
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </TableCell>
        </TableRow>
    )
}
