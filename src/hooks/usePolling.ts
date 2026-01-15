import { useEffect, useRef } from 'react';
import { Clip, LibraryItem } from '@/types';

interface UsePollingProps {
    clips: Clip[];
    libraryItems: LibraryItem[];
    refreshData: (silent?: boolean) => Promise<void>;
    intervalMs?: number;
}

interface PollTarget {
    type: 'CLIP' | 'LIBRARY';
    id: string; // row index
    taskId: string;
    model?: string;
}

// Logging Helper
const logRemote = (msg: string) => {
    fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
    }).catch(() => { });
};

export function usePolling({ clips, libraryItems, refreshData, intervalMs = 15000 }: UsePollingProps) {
    // State Refs for Polling Access (Avoids stale closures in setInterval)
    const clipsRef = useRef<Clip[]>([]);
    const libraryRef = useRef<LibraryItem[]>([]);

    // Track how many times we've seen a "Zombie" (Generating but no Task ID)
    const zombieTracker = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        clipsRef.current = clips;
        libraryRef.current = libraryItems;
    }, [clips, libraryItems]);

    useEffect(() => {
        logRemote(`[usePolling] Mounted. Interval: ${intervalMs}ms`);
        let isMounted = true;
        let timeoutId: NodeJS.Timeout;

        const poll = async () => {
            if (!isMounted) return;

            // Smart Polling Logic
            const clips = clipsRef.current;
            const libItems = libraryRef.current;
            const targets: PollTarget[] = [];

            // ... (Logic to build targets) ...

            // 1. Scan Clips
            clips.forEach(c => {
                // Case-Insensitive Check
                if (c.status?.toUpperCase() === 'GENERATING' && c.taskId) {
                    targets.push({ type: 'CLIP', id: c.id, taskId: c.taskId, model: c.model });
                }
            });

            // 2. Scan Library
            libItems.forEach(i => {
                // Case-Insensitive Check
                if (i.status?.toUpperCase() === 'GENERATING' && i.taskId && i.taskId.length > 5) {
                    targets.push({ type: 'LIBRARY', id: i.id, taskId: i.taskId, model: i.model || undefined });
                }
            });

            if (targets.length > 0) {
                logRemote(`[usePolling] Polling ${targets.length} targets. IDs: ${targets.map(t => t.taskId).join(',')}`);
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 10000);

                    const res = await fetch('/api/poll', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ targets }),
                        signal: controller.signal
                    });
                    clearTimeout(timeout);

                    const data = await res.json();

                    if (data.success && data.updated > 0) {
                        logRemote(`[usePolling] Updated > 0 (${data.updated}). Refreshing...`);
                        if (isMounted) {
                            await refreshData(true);
                            logRemote(`[usePolling] Refresh Complete.`);
                        } else {
                            logRemote(`[usePolling] ABORT: Unmounted after refresh.`);
                        }
                    } else {
                        logRemote(`[usePolling] Poll Success. No Updates.`);
                    }
                } catch (err: any) {
                    logRemote(`[usePolling] Error: ${err.message}`);
                }
            } else {
                logRemote(`[usePolling] Tick: No targets found. Active Clips=${clips.length}, Lib=${libItems.length}. Checking Status...`);
            }

            // Schedule next poll ONLY after this one completes
            if (isMounted) {
                // logRemote(`[usePolling] Scheduling next tick in ${intervalMs}ms`); 
                timeoutId = setTimeout(poll, intervalMs);
            } else {
                logRemote(`[usePolling] Unmounted. Stopping Loop.`);
            }
        };

        // Start Initial Poll
        timeoutId = setTimeout(poll, intervalMs);

        return () => {
            logRemote(`[usePolling] Effect Cleanup (Unmount/Re-run).`);
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [refreshData, intervalMs]);
}

