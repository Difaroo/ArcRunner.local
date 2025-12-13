import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { ClipRow } from "./ClipRow"
import { Clip } from "@/app/api/clips/route"
import { useState, useEffect } from "react"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"

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

    const [orderedClips, setOrderedClips] = useState(clips)

    useEffect(() => {
        setOrderedClips(clips)
    }, [clips])

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (active.id !== over?.id) {
            setOrderedClips((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id)
                const newIndex = items.findIndex((item) => item.id === over?.id)
                const newItems = arrayMove(items, oldIndex, newIndex)

                // Persist to API
                const updates = newItems.map((clip, index) => ({
                    id: clip.id,
                    sortOrder: (index + 1) * 10
                }))

                fetch('/api/sort', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updates })
                }).catch(err => console.error('Failed to save sort order:', err))

                return newItems
            })
        }
    }

    return (
        <div className="w-full h-full overflow-auto">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <Table className="table-fixed border-collapse">
                    <TableHeader className="sticky top-0 bg-black backdrop-blur-sm z-10">
                        <TableRow>
                            <TableHead className="w-[30px] p-0"></TableHead>
                            <TableHead className="w-[40px] px-0 text-center align-top py-3">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={onSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-[60px] font-semibold text-stone-500 text-left align-top py-3">SCN</TableHead>
                            <TableHead className="w-[12%] font-semibold text-stone-500 text-left align-top py-3 pl-1">TITLE</TableHead>
                            <TableHead className="w-[9%] font-semibold text-stone-500 text-left align-top py-3">CHARACTER</TableHead>
                            <TableHead className="w-[9%] font-semibold text-stone-500 text-left align-top py-3">LOCATION</TableHead>
                            <TableHead className="w-[9%] font-semibold text-stone-500 text-left align-top py-3">CAMERA</TableHead>
                            <TableHead className="w-[22%] font-semibold text-stone-500 text-left align-top py-3">ACTION</TableHead>
                            <TableHead className="w-[18%] font-semibold text-stone-500 text-left align-top py-3">DIALOG</TableHead>
                            <TableHead className="w-[140px] font-semibold text-stone-500 text-right align-top py-3 pr-[10px] pl-0">REF IMAGES</TableHead>
                            <TableHead className="w-[75px] font-semibold text-stone-500 text-right align-top py-3 pr-[10px] pl-0">RESULT</TableHead>
                            <TableHead className="w-[60px] font-semibold text-stone-500 text-right align-top py-3 pr-[25px] pl-0">STATUS</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <SortableContext
                            items={orderedClips.map(c => c.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {orderedClips.map((clip) => (
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
                        </SortableContext>
                    </TableBody>
                </Table>
            </DndContext>
        </div>
    )
}
