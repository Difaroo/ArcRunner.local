import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { ClipRow } from "./ClipRow"
import { Clip } from "@/types"
import { getComputedClipStatus } from "@/lib/clip-status"
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
    onSelectMultiple?: (ids: string[]) => void
    onSelect: (id: string) => void
    onEdit: (clip: Clip) => void
    onSave: (id: string, values: Partial<Clip>) => void | Promise<void>
    onCancelEdit: () => void
    onGenerate: (clip: Clip) => void
    onPlay: (url: string, contextPlaylist?: any[]) => void
    onDelete: (id: string) => void
    onDuplicate: (id: string) => void
    uniqueValues: {
        characters: string[]
        locations: string[]
        styles: string[]
        cameras: string[]
    }
    onResolveImage?: (name: string) => string | undefined
    onStudioAssetClick?: (name: string, type: 'CHARACTER' | 'LOCATION') => void
    onAddReference?: (clipId: string, url: string, type: 'IMAGE' | 'VIDEO') => Promise<void>
    seriesTitle: string
    activeModel?: string // Episode-level model for live icon updates
    onOpenBEM?: (clipId: string) => void // Open BEM for a specific clip
}

export function ClipTable({
    clips,
    selectedIds,
    editingId,
    saving,
    onSelectAll,
    onSelectMultiple,
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
    onStudioAssetClick,
    onAddReference,
    seriesTitle,
    activeModel,
    onOpenBEM
}: ClipTableProps) {
    const allSelected = clips.length > 0 && selectedIds.size === clips.length

    const [orderedClips, setOrderedClips] = useState(clips)

    // Traffic Light Bulk Selection Filter State
    const [trafficFilter, setTrafficFilter] = useState<'none' | 'red' | 'orange' | 'green'>('none')

    const handleTrafficCycle = () => {
        const sequence: ('none' | 'red' | 'orange' | 'green')[] = ['none', 'red', 'orange', 'green'];
        const currentIdx = sequence.indexOf(trafficFilter);
        const nextFilter = sequence[(currentIdx + 1) % sequence.length];
        setTrafficFilter(nextFilter);

        if (onSelectMultiple) {
            if (nextFilter === 'none') {
                onSelectMultiple([]);
            } else {
                const matchingIds = clips.filter(c => {
                    const status = getComputedClipStatus(c);
                    return status.colorClass.includes(nextFilter);
                }).map(c => c.id);
                onSelectMultiple(matchingIds);
            }
        }
    };

    const getTrafficColorClass = () => {
        switch (trafficFilter) {
            case 'red': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
            case 'orange': return 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]';
            case 'green': return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]';
            default: return 'bg-stone-700 hover:bg-stone-500';
        }
    };

    useEffect(() => {
        setOrderedClips(currentOrdered => {
            const clipMap = new Map(clips.map(c => [c.id, c]))

            // 1. Refresh existing items with new data (preserve current order)
            const updatedOrdered = currentOrdered
                .map(c => clipMap.get(c.id))
                .filter((c): c is Clip => !!c);

            const currentIds = new Set(currentOrdered.map(c => c.id))
            const newItems = clips.filter(c => !currentIds.has(c.id))

            if (newItems.length === 0) {
                // If only updates/deletions happened, return updated list
                if (updatedOrdered.length === currentOrdered.length) return updatedOrdered; // No structural changes, just data updates? Actually reference equality check is better but this is fine.
                return updatedOrdered;
            }

            // 2. Smart Insertion: Insert new items relative to their position in source 'clips'
            let finalOrdered = [...updatedOrdered];

            newItems.forEach(newItem => {
                // Find index in source 'clips'
                const sourceIndex = clips.findIndex(c => c.id === newItem.id);

                if (sourceIndex <= 0) {
                    // Start of list or not found (safety)
                    finalOrdered.unshift(newItem);
                } else {
                    // Find preceding neighbor in source list
                    const neighbor = clips[sourceIndex - 1];
                    // Find where that neighbor is in our local ordered list
                    const neighborIndex = finalOrdered.findIndex(c => c.id === neighbor.id);

                    if (neighborIndex !== -1) {
                        // Insert immediately after the neighbor
                        finalOrdered.splice(neighborIndex + 1, 0, newItem);
                    } else {
                        // Neighbor key missing from ordered list? (Complex case)
                        // Fallback: Append to end or try to find next neighbor?
                        // Simplest robust fallback: Push to end.
                        finalOrdered.push(newItem);
                    }
                }
            });

            return finalOrdered;
        })
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
                            <TableHead className="w-[20px] p-0 text-center align-middle py-3">
                                <button
                                    onClick={handleTrafficCycle}
                                    className={`w-3 h-3 mx-auto block rounded-full ring-1 ring-white/10 transition-all duration-200 cursor-pointer ${getTrafficColorClass()}`}
                                    title={`Filter Status: ${trafficFilter === 'none' ? 'Off' : trafficFilter}`}
                                />
                            </TableHead>
                            <TableHead className="w-[28px] px-0 text-center align-top py-3">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={onSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-[24px] px-1 font-medium text-stone-500 text-left align-top py-3">SCN</TableHead>
                            <TableHead className="w-[160px] font-medium text-stone-500 text-left align-top py-3">TITLE</TableHead>
                            <TableHead className="w-[170px] font-medium text-stone-500 text-left align-top py-3">CHARACTER</TableHead>
                            <TableHead className="w-[170px] font-medium text-stone-500 text-left align-top py-3">LOCATION</TableHead>
                            <TableHead className="w-[140px] font-medium text-stone-500 text-left align-top py-3">CAMERA</TableHead>
                            <TableHead className="w-[15%] font-medium text-stone-500 text-left align-top py-3">ACTION</TableHead>
                            <TableHead className="w-[15%] font-medium text-stone-500 text-left align-top py-3">DIALOG</TableHead>
                            <TableHead className="w-[80px] font-medium text-stone-500 text-right align-top py-3">GENERATE</TableHead>
                            <TableHead className="w-[80px] font-medium text-stone-500 text-left align-top py-3">RESULT</TableHead>
                            <TableHead className="w-[40px] font-medium text-stone-500 text-left align-top py-3 px-1">STATUS</TableHead>
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
                                    onStudioAssetClick={onStudioAssetClick}
                                    onAddReference={onAddReference}
                                    seriesTitle={seriesTitle}
                                    activeModel={activeModel}
                                    onOpenBEM={onOpenBEM}
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
