import React from 'react';

interface EditableCellProps {
    isEditing: boolean;
    onStartEdit: () => void;
    children: React.ReactNode;
    className?: string;
}

export function EditableCell({ isEditing, onStartEdit, children, className = "" }: EditableCellProps) {
    if (isEditing) {
        return <>{children}</>;
    }

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
            }}
            className={`cursor-pointer hover:bg-stone-800/50 p-1 rounded -m-1 transition h-full ${className}`}
            title="Click to edit"
        >
            {children}
        </div>
    );
}
