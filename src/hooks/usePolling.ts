import { useEffect, useRef } from 'react';
import { Clip } from '@/app/api/clips/route';
import { LibraryItem } from '@/app/page';

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
    sheetRow?: number; // Calculated on server, but can pass if needed. Server can calc from ID.
}

export function usePolling({ clips, libraryItems, refreshData, intervalMs = 15000 }: UsePollingProps) {
    // State Refs for Polling Access (Avoids stale closures in setInterval)
    const clipsRef = useRef<Clip[]>([]);
    const libraryRef = useRef<LibraryItem[]>([]);

    // Track how many times we've seen a "Zombie" (Generating but no Task ID)
    // ID -> Count
    const zombieTracker = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        clipsRef.current = clips;
        libraryRef.current = libraryItems;
    }, [clips, libraryItems]);

    useEffect(() => {
        const pollInterval = setInterval(async () => {
            // Smart Polling Logic
            const clips = clipsRef.current;
            const libItems = libraryRef.current;
            const targets: PollTarget[] = [];

            // Set of currently detected zombies to clean up old entries
            const detectedZombies = new Set<string>();

            // 1. Scan Clips
            clips.forEach(c => {
                const isZombie = c.status === 'Generating' && (!c.resultUrl || !c.resultUrl.trim());

                if (c.status === 'Generating' || (c.resultUrl && c.resultUrl.startsWith('TASK:'))) {
                    // Check if valid task ID (or if it's "Generating" without a task ID yet -> Zombie Candidate)
                    // If it's just 'Generating' with no URL, it might be a zombie, but we need a Task ID to check Kie.
                    // If no Task ID, we can't check Kie. But we might want to tell the server to "timeout" it?
                    // For now, only poll valid TASK: IDs.
                    if (c.resultUrl && c.resultUrl.startsWith('TASK:')) {
                        targets.push({
                            type: 'CLIP',
                            id: c.id,
                            taskId: c.resultUrl.replace('TASK:', '')
                        });
                    } else if (isZombie) {
                        // ZOMBIE DETECTED
                        detectedZombies.add(c.id);
                        const currentCount = zombieTracker.current.get(c.id) || 0;
                        const newCount = currentCount + 1;
                        zombieTracker.current.set(c.id, newCount);

                        // Grace Period: Must be detected for 3 intervals (e.g. 45s) before killing.
                        // This allows slow server writes to finish.
                        if (newCount >= 3) {
                            console.warn(`Zombie Task detected at index ${c.id} for ${newCount} cycles. Auto-fixing...`);
                            fetch('/api/update_clip', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ rowIndex: c.id, updates: { status: 'Error', resultUrl: 'ERR_ZOMBIE' } })
                            }).then(() => {
                                refreshData(true);
                                zombieTracker.current.delete(c.id); // Reset
                            });
                        } else {
                            console.log(`Potential Zombie ${c.id} count: ${newCount}/3. Refreshing to check for ID...`);
                            // KEY FIX: We MUST refresh data to see if the ID has appeared in the sheet!
                            // If we don't refresh, we are just counting securely in a loop with stale data.
                            refreshData(true);
                        }
                    }
                }
            });

            // Clean up tracker for clips that are no longer zombies
            for (const id of zombieTracker.current.keys()) {
                if (!detectedZombies.has(id)) {
                    zombieTracker.current.delete(id);
                }
            }


            // 2. Scan Library
            libItems.forEach(i => {
                if (i.refImageUrl && i.refImageUrl.startsWith('TASK:')) {
                    targets.push({
                        type: 'LIBRARY',
                        id: i.id,
                        taskId: i.refImageUrl.replace('TASK:', '')
                    });
                }
            });

            if (targets.length === 0) {
                return;
            }

            console.log(`Polling ${targets.length} active tasks...`);

            try {
                const res = await fetch('/api/poll', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targets }),
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
