import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { ClipRow } from "./ClipRow"
import { Clip } from "@/app/api/clips/route"

interface ClipTableProps {
    clips: Clip[]
    selectedIds: Set<string>
    editingId: string | null
    saving: boolean
    onSelectAll: () => void
    onSelect: (id: string) => void
    onEdit: (clip: Clip) => void
    onSave: (id: string, values: Partial<Clip>) => void
    onCancelEdit: () => void
    onGenerate: (clip: Clip) => void
    onPlay: (url: string) => void
    uniqueValues: {
        characters: string[]
        locations: string[]
        styles: string[]
        cameras: string[]
    }
}

export function ClipTable({
    clips,
    selectedIds,
    editingId,
    saving,
    onSelectAll,
    onSelect,
    onEdit,
    onSave,
    onCancelEdit,
    onGenerate,
    onPlay,
    uniqueValues
}: ClipTableProps) {
    const allSelected = clips.length > 0 && selectedIds.size === clips.length

    return (
        <div className="w-full h-full overflow-auto">
            <Table>
                <TableHeader className="sticky top-0 bg-black backdrop-blur-sm z-10">
                    <TableRow>
                        <TableHead className="w-10 text-center align-top py-3">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={onSelectAll}
                            />
                        </TableHead>
                        <TableHead className="w-[60px] font-semibold text-stone-500 text-left align-top py-3">SCN</TableHead>
                        <TableHead className="w-[13%] font-semibold text-stone-500 text-left align-top py-3 pl-1">TITLE</TableHead>
                        <TableHead className="w-16 font-semibold text-stone-500 text-left align-top py-3">CHARACTER</TableHead>
                        <TableHead className="w-32 font-semibold text-stone-500 text-left align-top py-3">LOCATION</TableHead>
                        <TableHead className="w-32 font-semibold text-stone-500 text-left align-top py-3">STYLE/CAM</TableHead>
                        <TableHead className="w-1/4 font-semibold text-stone-500 text-left align-top py-3">ACTION</TableHead>
                        <TableHead className="w-1/6 font-semibold text-stone-500 text-left align-top py-3">DIALOG</TableHead>
                        <TableHead className="w-24 font-semibold text-stone-500 text-left align-top py-3">REF IMG</TableHead>
                        <TableHead className="text-right w-24 font-semibold text-stone-500 align-top py-3">STATUS</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {clips.map((clip) => (
                        <ClipRow
                            key={clip.id}
                            clip={clip}
                            isSelected={selectedIds.has(clip.id)}
                            isEditing={editingId === clip.id}
                            onSelect={onSelect}
                            onEdit={onEdit}
                            onSave={onSave}
                            onCancelEdit={onCancelEdit}
                            onGenerate={onGenerate}
                            onPlay={onPlay}
                            saving={saving}
                            uniqueValues={uniqueValues}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
