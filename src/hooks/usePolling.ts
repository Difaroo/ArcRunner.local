import { useEffect, useRef } from 'react';
import { Clip } from '@/app/api/clips/route';
import { LibraryItem } from '@/lib/library';

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
}

export function usePolling({ clips, libraryItems, refreshData, intervalMs = 15000 }: UsePollingProps) {
    // State Refs for Polling Access (Avoids stale closures in setInterval)
    const clipsRef = useRef<Clip[]>([]);
    const libraryRef = useRef<LibraryItem[]>([]);

    // Track how many times we've seen a "Zombie" (Generating but no Task ID)
    // ID -> Count
    const zombieTracker = useRef<Map<string, number>>(new Map());

    // Track Zombie Candidates (id -> timestamp)
    const zombieCandidates = useRef<Map<string, number>>(new Map());

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
            const zombies: { type: 'CLIP', id: string }[] = [];

            // Set of currently detected zombies to clean up old entries
            const detectedZombies = new Set<string>();

            // 1. Scan Clips
            clips.forEach(c => {
                const isGenerating = c.status === 'Generating';
                const hasTask = c.taskId && c.taskId.trim().length > 0;

                // Zombie Definition:
                // 1. Status is Generating
                // 2. AND (TaskId is empty)
                const isZombie = isGenerating && !hasTask;

                if (isZombie) {
                    detectedZombies.add(c.id);
                    const currentCount = zombieTracker.current.get(c.id) || 0;
                    const newCount = currentCount + 1;
                    zombieTracker.current.set(c.id, newCount);

                    // Grace Period: Must be detected for 3 intervals (e.g. 45s) before killing.
                    if (newCount >= 3) {
                        console.warn(`[Polling] Zombie Task detected at index ${c.id} for ${newCount} cycles. Auto-fixing...`);
                        fetch('/api/update_clip', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rowIndex: c.id, updates: { status: 'Error', resultUrl: 'ERR_ZOMBIE' } }) // Keep explicit zombie marker? Or just Error? 
                            // User wants to keep previous result. But if it was a zombie, maybe we update status only?
                            // But usually zombie means it never started properly.
                            // Let's stick to Error for now.
                        }).then(() => {
                            refreshData(true);
                            zombieTracker.current.delete(c.id); // Reset
                        });
                    } else {
                        console.log(`[Polling] Potential Zombie ${c.id} count: ${newCount}/3. Refreshing to check for ID...`);
                        refreshData(true);
                    }
                } else if (isGenerating && hasTask) {
                    targets.push({
                        type: 'CLIP',
                        id: c.id,
                        taskId: c.taskId!
                    });
                }
            });

            // Clean up tracker for clips that are no longer zombies
            for (const id of zombieTracker.current.keys()) {
                if (!detectedZombies.has(id)) {
                    zombieTracker.current.delete(id);
                }
            }

            // 2. Scan Library (Still uses resultUrl/refImageUrl format?)
            // Library items might store "TASK:..." in refImageUrl. 
            // We should ideally fix Library schema too, but for now we follow old pattern if needed
            // OR checks generic 'refImageUrl'.
            libItems.forEach(i => {
                // Determine if library item is generating
                // LibraryItems don't have a 'status' field?
                // The API/Types show 'refImageUrl'. 
                // Kie logic usually saves result to refImageUrl directly.
                // If we want polling for library, we need to know if it's a task.
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

            console.log(`[Polling] Checking ${targets.length} active tasks...`);

            try {
                const res = await fetch('/api/poll', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targets }),
                });

                const data = await res.json();

                if (data.success && data.updated > 0) {
                    console.log(`[Polling] Updated ${data.updated} items. Silent Refreshing...`);
                    await refreshData(true);
                }
            } catch (err) {
                console.error('[Polling] Error:', err);
            }
        }, intervalMs);

        return () => clearInterval(pollInterval);
    }, [refreshData, intervalMs]);
}
