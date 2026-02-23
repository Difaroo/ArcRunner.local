import { Clip } from '@/types';

export type ComputedState = 'Pending' | 'Ready' | 'Generating' | 'Done' | 'Complete' | 'Error';

export interface ClipStatusInfo {
    label: string;      // "Saved [2]", "Error", "Done"
    state: ComputedState;
    colorClass: string; // Tailwind class string for dots
    isError: boolean;
}

/**
 * Computes the structural status of a Clip based on the absolute truth of its data fields
 * rather than relying 100% on the string `status` column which can decouple from reality.
 */
export function getComputedClipStatus(clip: Partial<Clip>): ClipStatusInfo {
    // 1. Explicit Error Strings
    // If the backend / Kie polling explicitly wrote an error, respect it.
    if (clip.status?.toLowerCase().includes('error')) {
        return {
            label: 'Error',
            state: 'Error',
            colorClass: 'bg-red-500',
            isError: true
        };
    }

    // 2. In Progress (Generating) explicitly set by UI or Poll
    // CRITICAL: Must be checked before 'Done' state to ensure regenerating a clip with history shows a spinner.
    if (clip.status === 'Generating') {
        return {
            label: 'Generating',
            state: 'Generating',
            colorClass: 'bg-green-500', // UI usually animates this
            isError: false
        };
    }

    // 3. Structural Results Exist (Highest Truth)
    const hasMediaResults = (clip.mediaResults && clip.mediaResults.length > 0);
    const hasResultUrl = !!clip.resultUrl;

    if (hasMediaResults || hasResultUrl) {
        // If it's persisted/downloaded, map to "Complete" visually
        if (clip.isPersisted || clip.status?.startsWith('Saved') || clip.status === 'Complete') {
            // Retain "Saved [2]" style string versions if they exist
            const label = clip.status?.startsWith('Saved') ? clip.status : 'Complete';
            return {
                label,
                state: 'Complete',
                colorClass: 'bg-black ring-stone-600',
                isError: false
            };
        }

        // Otherwise, it finished generating but is unhandled by the user
        return {
            label: 'Done',
            state: 'Done',
            colorClass: 'bg-green-500',
            isError: false
        };
    }

    // 4. In Progress (Fallback for taskID without explicit status)
    if (clip.taskId) {
        return {
            label: 'Generating',
            state: 'Generating',
            colorClass: 'bg-green-500', // UI usually animates this
            isError: false
        };
    }

    // 4. Ready (Has prompt vs missing core data)
    // "Ready" usually means it has an Action prompt and can be sent to generation.
    // If not, it's missing data.
    if (clip.action && clip.action.trim().length > 0) {
        return {
            label: 'Ready',
            state: 'Ready',
            colorClass: 'bg-orange-500',
            isError: false
        };
    }

    if (clip.status === 'Ready') {
        return {
            label: 'Ready',
            state: 'Ready',
            colorClass: 'bg-orange-500',
            isError: false
        };
    }

    // 5. Default Fallback
    return {
        label: 'Pending',
        state: 'Pending',
        colorClass: 'bg-red-500',
        isError: false
    };
}
