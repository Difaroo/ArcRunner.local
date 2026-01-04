import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { ClipRow } from "./ClipRow"
import { Clip } from '@/types';
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
    onDelete: (id: string) => void
    onDuplicate: (id: string) => void
    uniqueValues: {
        characters: string[]
        locations: string[]
        styles: string[]
        cameras: string[]
    }
    onResolveImage?: (name: string) => string | undefined
    seriesTitle: string
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
    onDelete,
    onDuplicate,
    uniqueValues,
    onResolveImage,
    seriesTitle
}: ClipTableProps) {
    // ... (skip down to SortableContext)
    // I need to use replace_file_content targeted chunks.
    // This single block is safer for the Props interface.
    // But I also need to update the <ClipRow> call further down.
    // I will split this into two tool calls or use multi_replace.
    // I'll assume sequential for safety.
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
                            <TableHead className="w-[10px] p-0 text-center align-top py-3"></TableHead>
                            <TableHead className="w-[28px] px-0 text-center align-top py-3">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={onSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-[24px] px-1 font-semibold text-stone-500 text-left align-top py-3">SCN</TableHead>
                            <TableHead className="w-[160px] font-semibold text-stone-500 text-left align-top py-3">TITLE</TableHead>
                            <TableHead className="w-[170px] font-semibold text-stone-500 text-left align-top py-3">CHARACTER</TableHead>
                            <TableHead className="w-[170px] font-semibold text-stone-500 text-left align-top py-3">LOCATION</TableHead>
                            <TableHead className="w-[140px] font-semibold text-stone-500 text-left align-top py-3">CAMERA</TableHead>
                            <TableHead className="w-[15%] font-semibold text-stone-500 text-left align-top py-3">ACTION</TableHead>
                            <TableHead className="w-[15%] font-semibold text-stone-500 text-left align-top py-3">DIALOG</TableHead>
                            <TableHead className="w-[80px] font-semibold text-stone-500 text-right align-top py-3">REF IMAGES</TableHead>
                            <TableHead className="w-[80px] font-semibold text-stone-500 text-left align-top py-3">RESULT</TableHead>
                            <TableHead className="w-[40px] font-semibold text-stone-500 text-left align-top py-3 px-1">STATUS</TableHead>
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
                                    onDelete={onDelete}
                                    onDuplicate={onDuplicate}
                                    saving={saving}
                                    uniqueValues={uniqueValues}
                                    onResolveImage={onResolveImage}
                                    seriesTitle={seriesTitle}
                                />
                            ))}
                        </SortableContext>
                        {clips.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={12} className="h-24 text-center text-stone-500">
                                    No clips found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </DndContext>
        </div>
    )
}
