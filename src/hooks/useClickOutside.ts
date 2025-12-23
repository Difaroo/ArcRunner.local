import { useEffect } from 'react';

export function useClickOutside(
    ref: React.RefObject<HTMLElement>,
    handler: (event: MouseEvent | TouchEvent) => void,
    isActive: boolean
) {
    useEffect(() => {
        if (!isActive) return;

        const listener = (event: MouseEvent | TouchEvent) => {
            const el = ref?.current;
            // Do nothing if clicking ref's element or descendent elements
            if (!el || el.contains(event.target as Node)) {
                return;
            }
            handler(event);
        };

        // Use capture phase to handle events before they might be stopped by children
        document.addEventListener('mousedown', listener, true);
        document.addEventListener('touchstart', listener, true);

        return () => {
            document.removeEventListener('mousedown', listener, true);
            document.removeEventListener('touchstart', listener, true);
        };
    }, [ref, handler, isActive]);
}
