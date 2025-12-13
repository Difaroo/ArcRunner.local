import { useEffect, useRef } from 'react';
import { Clip } from '@/app/api/clips/route';
import { LibraryItem } from '@/app/page';

interface UsePollingProps {
    clips: Clip[];
    libraryItems: LibraryItem[];
    refreshData: (silent?: boolean) => Promise<void>;
    intervalMs?: number;
}

export function usePolling({ clips, libraryItems, refreshData, intervalMs = 15000 }: UsePollingProps) {
    // State Refs for Polling Access (Avoids stale closures in setInterval)
    const clipsRef = useRef<Clip[]>([]);
    const libraryRef = useRef<LibraryItem[]>([]);

    useEffect(() => {
        clipsRef.current = clips;
        libraryRef.current = libraryItems;
    }, [clips, libraryItems]);

    useEffect(() => {
        const pollInterval = setInterval(async () => {
            // Smart Polling Logic
            const clips = clipsRef.current;
            const libItems = libraryRef.current;

            const activeClipsCount = clips.filter(c => c.status === 'Generating' || (c.resultUrl && c.resultUrl.startsWith('TASK:'))).length;
            const activeLibCount = libItems.filter(i => i.refImageUrl && i.refImageUrl.startsWith('TASK:')).length;
            const hasActiveTasks = activeClipsCount > 0 || activeLibCount > 0;

            if (!hasActiveTasks) {
                return;
            }

            try {
                const res = await fetch('/api/poll', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });

                const data = await res.json();

                if (data.success && data.updated > 0) {
                    console.log(`Poll updated ${data.updated} items. Silent Refreshing...`);
                    // SILENT REFRESH: Doesn't trigger global loading spinner
                    await refreshData(true);
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, intervalMs);

        return () => clearInterval(pollInterval);
    }, [refreshData, intervalMs]);
}
