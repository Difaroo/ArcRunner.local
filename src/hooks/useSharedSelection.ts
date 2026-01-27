import { useState, useEffect } from 'react';

export function useSharedSelection(allItems: { id: string }[], persistenceKey?: string) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isHydrated, setIsHydrated] = useState(false);

    // Hydration Logic
    useEffect(() => {
        if (!persistenceKey) {
            setIsHydrated(true);
            return;
        }

        const saved = localStorage.getItem(persistenceKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setSelectedIds(new Set(parsed));
                }
            } catch (e) {
                console.error("Failed to restore selection:", e);
            }
        }
        setIsHydrated(true);
    }, [persistenceKey]);

    // Persistence Logic
    useEffect(() => {
        if (!persistenceKey || !isHydrated) return;
        localStorage.setItem(persistenceKey, JSON.stringify(Array.from(selectedIds)));
    }, [selectedIds, persistenceKey, isHydrated]);

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
