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
            const target = event.target as Element;

            // Do nothing if clicking ref's element or descendent elements
            if (!el || el.contains(target as Node)) {
                return;
            }

            // IGNORE RADIX UI PORTALS (Dropdowns, Dialogs, Tooltips)
            // These render outside the DOM hierarchy but are conceptually "inside" the UI flow.
            // We check for the portal wrapper attribute or role="menu".
            if (target.closest('[data-radix-popper-content-wrapper]') ||
                target.closest('[role="menu"]') ||
                target.closest('[role="dialog"]') ||
                target.closest('.radix-themes-overlay')) {
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
