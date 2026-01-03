import { useEffect } from 'react';

interface UseRowShortcutsProps {
    isEditing: boolean;
    onSave?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onCancel?: () => void;
}

export function useRowShortcuts({
    isEditing,
    onSave,
    onDuplicate,
    onDelete,
    onCancel
}: UseRowShortcutsProps) {
    useEffect(() => {
        if (!isEditing) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Save: Cmd+Enter or Ctrl+Enter
            // 'Enter' covers both Return and Enter keys
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                onSave?.();
                return;
            }

            // Duplicate: Cmd+D or Ctrl+D
            if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                onDuplicate?.();
                return;
            }

            // Delete: Cmd+Backspace or Cmd+Delete (Fn+Backspace on Mac laptops)
            if ((e.metaKey || e.ctrlKey) && (e.key === 'Backspace' || e.key === 'Delete')) {
                e.preventDefault();
                onDelete?.();
                return;
            }

            // Cancel: Escape or Cmd+. (Period)
            if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === '.')) {
                e.preventDefault();
                onCancel?.();
                return;
            }
        };

        // Use capture phase or just bubbling? Bubbling on window is usually fine for "modal-like" row editing.
        // However, if an input traps the key (stopPropagation), this might not fire if not capturing.
        // Inputs usually don't trap Cmd+Enter/Cmd+D unless specifically handled.
        // Let's stick to bubbling first.
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditing, onSave, onDuplicate, onDelete, onCancel]);
}
