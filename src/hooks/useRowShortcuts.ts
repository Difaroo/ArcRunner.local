import { useEffect } from 'react';

interface UseRowShortcutsProps {
    isEditing: boolean;
    isSelected?: boolean;
    onSave?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onCancel?: () => void;
    onDownload?: () => void;
}

export function useRowShortcuts({
    isEditing,
    isSelected,
    onSave,
    onDuplicate,
    onDelete,
    onCancel,
    onDownload
}: UseRowShortcutsProps) {
    useEffect(() => {
        // Only active if Editing OR Selected
        if (!isEditing && !isSelected) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Save: Cmd+Enter OR Cmd+S (if Editing) OR Cmd+S (if Selected and onDownload)
            if (e.metaKey || e.ctrlKey) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onSave?.();
                    return;
                }

                if (e.key === 's' || e.key === 'S') {
                    e.preventDefault();
                    if (isEditing) {
                        onSave?.();
                    } else if (isSelected) {
                        onDownload?.();
                    }
                    return;
                }

                if (e.key === 'd' || e.key === 'D') {
                    e.preventDefault();
                    onDuplicate?.();
                    return;
                }

                if (e.key === 'Backspace' || e.key === 'Delete') {
                    e.preventDefault();
                    onDelete?.();
                    return;
                }

                if (e.key === '.') {
                    e.preventDefault();
                    onCancel?.();
                    return;
                }
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel?.();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditing, isSelected, onSave, onDuplicate, onDelete, onCancel, onDownload]);
}
