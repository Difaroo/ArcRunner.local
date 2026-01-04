import { useState, useCallback } from 'react';

export function useSharedSelection(allItems: { id: string }[]) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    }, []);

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
