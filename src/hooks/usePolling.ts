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
            // Smart Polling: Only poll if we have known active tasks
            const hasActiveClips = clipsRef.current.some(c => c.status === 'Generating' || (c.resultUrl && c.resultUrl.startsWith('TASK:')));
            const hasActiveLib = libraryRef.current.some(i => i.refImageUrl && i.refImageUrl.startsWith('TASK:'));

            if (!hasActiveClips && !hasActiveLib) {
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
