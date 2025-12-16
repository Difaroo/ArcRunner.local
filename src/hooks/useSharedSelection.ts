import { useState } from 'react';

export function useSharedSelection(allItems: { id: string }[]) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === allItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(allItems.map(i => i.id)));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    return { selectedIds, setSelectedIds, toggleSelect, toggleSelectAll, clearSelection };
}
