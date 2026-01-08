import { useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { ImageUploadCell } from "@/components/ui/ImageUploadCell";
import { EditableCell } from "@/components/ui/EditableCell";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { MediaDisplay } from "@/components/media/MediaDisplay";
import { RowActions } from "@/components/ui/RowActions";
import { LibraryItem } from '@/lib/library';
import { useClickOutside } from "@/hooks/useClickOutside";
import { useRowShortcuts } from "@/hooks/useRowShortcuts";

interface LibraryRowProps {
    item: LibraryItem;
    isSelected: boolean;
    isEditing: boolean;
    isGenerating: boolean;
    onSelect: (id: string) => void;
    onStartEdit: (item: LibraryItem) => void;
    onCancelEdit: () => void;
    onSave: (id: string, updates: Partial<LibraryItem>) => Promise<void> | void;
    onGenerate?: (item: LibraryItem) => void;
    onDelete?: (id: string) => void;
    onPlay?: (url: string) => void;
    onDownload: (url: string, name: string) => void;
    onDuplicate?: (id: string) => void;
}

export function LibraryRow({
    item,
    isSelected,
    isEditing,
    isGenerating,
    onSelect,
    onStartEdit,
    onCancelEdit,
    onSave,
    onGenerate,
    onDelete,
    onPlay,
    onDownload,
    onDuplicate
}: LibraryRowProps) {
    const [editValues, setEditValues] = useState<Partial<LibraryItem>>({});

    const [saving, setSaving] = useState(false);
    const [autoOpenUpload, setAutoOpenUpload] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const LIBRARY_TYPES = ['LIB_CHARACTER', 'LIB_LOCATION', 'LIB_STYLE', 'LIB_CAMERA'];

    // Initialize edit values when editing starts
    // But since the parent controls isEditing, we need to know WHEN it becomes true.
    // Parent handles onStartEdit which sets the master ID.
    // Here we should sync state. 
    // Actually, LibraryTable had `handleStartEdit` that set `editValues`.
    // If we move logic here, we need to init explicitely.
    // Better: use useEffect to reset/init editValues when isEditing becomes true.
    // OR: Parent passes `editValues`? No, let's keep form state local to Row if possible?
    // If we keep form state local, valid.

    // We'll use a ref to track previous editing state to detecting mounting/switching?
    // Simply: When `onStartEdit` is called (by user click), we set Parent ID. 
    // AND we can set Local State.

    // BUT wait, in LibraryTable, `handleStartEdit` calculated `editValues`.
    // We should move that logic to `startLocalEdit`.

    const startLocalEdit = () => {
        const { refImageUrl, ...rest } = item;
        // Sanitize: If Task ID, Error Status, or valid Error string -> Clear it for editing
        const status = item.status?.toLowerCase() || '';
        let urlCandidate = refImageUrl || '';

        const isErrorStatus = status.includes('error') || status.includes('failed');
        const isGarbage = urlCandidate.startsWith('TASK:') || urlCandidate.startsWith('DEBUG') || urlCandidate.length > 3000;

        // Final check: Must start with http or /
        const isUrl = urlCandidate.match(/^(http|\/)/);

        const safeUrl = (isErrorStatus || isGarbage || !isUrl) ? '' : urlCandidate;

        setEditValues({ ...rest, refImageUrl: safeUrl });
        onStartEdit(item);
    };

    const handleLocalSave = async () => {
        setSaving(true);
        try {
            await onSave(item.id, editValues);
            // onSave success should eventually cause isEditing to become false from parent?
            // LibraryTable: handleSave calls onSave prop then sets editingId(null).
            // So isEditing becomes false.
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof LibraryItem, value: string) => {
        setEditValues(prev => ({ ...prev, [field]: value }));
    };

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Click Outside
    // We need a ref for the TR
    const rowRef = useRef<HTMLTableRowElement>(null);
    useClickOutside(rowRef as React.RefObject<HTMLElement>, () => {
        if (isEditing) {
            if (showDeleteDialog || isDropdownOpen) return;
            // Save on blur instead of cancel to prevent data loss
            onCancelEdit();
        }
    }, isEditing);

    const handleDeleteClick = () => {
        setShowDeleteDialog(true);
    };

    const confirmDelete = async () => {
        try {
            const res = await fetch('/api/library', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id })
            });

            if (!res.ok) throw new Error('Failed to delete');

            if (onDelete) onDelete(item.id);

        } catch (e) {
            console.error('Delete failed', e);
            alert('Failed to delete item');
        } finally {
            setShowDeleteDialog(false);
        }
    };

    useRowShortcuts({
        isEditing,
        onSave: handleLocalSave,
        onDuplicate: onDuplicate ? () => onDuplicate(item.id) : undefined,
        onDelete: handleDeleteClick,
        onCancel: onCancelEdit
    });

    return (
        <TableRow
            ref={rowRef}
            className={`group hover:bg-black transition-colors ${isEditing || isSelected ? 'bg-black' : ''}`}
            data-testid="library-row"
        >
            <TableCell className="align-top py-3 px-2">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelect(item.id)}
                />
            </TableCell>

            <TableCell className={`font-mono text-xs text-stone-500 align-top ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={startLocalEdit}>
                    {isEditing ? (
                        <Input
                            value={editValues.episode || ''}
                            onChange={e => handleChange('episode', e.target.value)}
                            onKeyDown={e => e.key === 'Escape' && onCancelEdit()}
                            className="table-input h-full w-12 text-center"
                        />
                    ) : (
                        <span className="table-text">{item.episode}</span>
                    )}
                </EditableCell>
            </TableCell>

            {/* Name */}
            <TableCell className={`align-top ${isEditing ? "p-1" : "py-3"}`} data-testid="cell-name">
                <EditableCell isEditing={isEditing} onStartEdit={startLocalEdit}>
                    {isEditing ? (
                        <Input
                            value={editValues.name || ''}
                            onChange={e => handleChange('name', e.target.value)}
                            onKeyDown={e => e.key === 'Escape' && onCancelEdit()}
                            className="table-input h-full"
                        />
                    ) : (
                        <span className="table-text font-medium">{item.name}</span>
                    )}
                </EditableCell>
            </TableCell>

            {/* Type Dropdown */}
            <TableCell className={`align-top ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={startLocalEdit}>
                    {isEditing ? (
                        <DropdownMenu onOpenChange={setIsDropdownOpen}>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-full w-full justify-start text-[10px] px-2 text-left truncate border-stone-700 bg-stone-900 text-stone-300">
                                                {editValues.type?.replace('LIB_', '') || "Select..."}
                                            </Button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Select Library Type</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <DropdownMenuContent className="bg-stone-900 border-stone-800 text-white">
                                {LIBRARY_TYPES.map(type => (
                                    <DropdownMenuItem
                                        key={type}
                                        onClick={() => handleChange('type', type)}
                                        className="text-xs focus:bg-stone-800 focus:text-white"
                                    >
                                        {type.replace('LIB_', '')}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Badge variant="outline" className="text-[10px] border-stone-700 text-stone-400 font-normal">
                            {item.type.replace('LIB_', '')}
                        </Badge>
                    )}
                </EditableCell>
            </TableCell>

            {/* Description */}
            <TableCell className={`align-top ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={startLocalEdit}>
                    {isEditing ? (
                        <AutoResizeTextarea
                            value={editValues.description || ''}
                            onChange={e => handleChange('description', e.target.value)}
                            onKeyDown={e => e.key === 'Escape' && onCancelEdit()}
                            className="min-h-[60px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-extralight leading-relaxed"
                        />
                    ) : (
                        <span className="table-text whitespace-pre-wrap">{item.description || '+'}</span>
                    )}
                </EditableCell>
            </TableCell>

            {/* Negatives */}
            <TableCell className={`align-top ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={startLocalEdit}>
                    {isEditing ? (
                        <Input
                            value={editValues.negatives || ''}
                            onChange={e => handleChange('negatives', e.target.value)}
                            onKeyDown={e => e.key === 'Escape' && onCancelEdit()}
                            className="table-input h-full"
                        />
                    ) : (
                        <span className="table-text">{item.negatives || '+'}</span>
                    )}
                </EditableCell>
            </TableCell>

            {/* Notes */}
            <TableCell className={`align-top ${isEditing ? "p-1" : "py-3"}`}>
                <EditableCell isEditing={isEditing} onStartEdit={startLocalEdit}>
                    {isEditing ? (
                        <Input
                            value={editValues.notes || ''}
                            onChange={e => handleChange('notes', e.target.value)}
                            onKeyDown={e => e.key === 'Escape' && onCancelEdit()}
                            className="table-input italic h-full"
                        />
                    ) : (
                        <span className="table-text italic">{item.notes || '+'}</span>
                    )}
                </EditableCell>
            </TableCell>

            {/* Ref Image */}
            <TableCell className={`align-top px-3 ${isEditing ? "py-1" : "py-3"}`}>
                {isEditing ? (
                    <ImageUploadCell
                        value={(editValues.refImageUrl && editValues.refImageUrl.match(/^(http|\/)/) && editValues.refImageUrl.length < 500) ? editValues.refImageUrl : ''}
                        onChange={(url) => handleChange('refImageUrl', url)}
                        isEditing={true}
                        autoOpen={autoOpenUpload}
                        onAutoOpenComplete={() => setAutoOpenUpload(false)}
                        episode={item.episode}
                    />
                ) : (
                    // View Mode
                    item.refImageUrl ? (
                        isGenerating ? (
                            <div className="w-24 h-24 rounded-md border border-stone-800 bg-stone-900 flex flex-col items-center justify-center">
                                <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
                                <span className="text-[10px] text-stone-500 font-mono">Generating...</span>
                            </div>
                        ) : item.status === 'Error' ? (
                            <div className="w-24 h-24 rounded-md border border-red-900/50 bg-red-950/20 flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                                <span className="material-symbols-outlined text-red-500 mb-1">error</span>
                                <span className="text-[10px] text-red-400 font-mono font-bold">Failed</span>
                            </div>
                        ) : (
                            <div className="flex justify-start w-24 h-24">
                                <MediaDisplay
                                    url={item.thumbnailPath || item.refImageUrl}
                                    originalUrl={item.refImageUrl}
                                    title={item.name}
                                    isThumbnail={!!item.thumbnailPath}
                                    // onPlay={onPlay || (() => { })} // Removed
                                    className="w-full h-full"
                                />
                            </div>
                        )
                    ) : (
                        // Empty state - Show Add Button with Auto-Open behavior
                        <div className="w-full h-full min-h-[40px] flex items-center justify-center">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="btn-icon-action w-full"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAutoOpenUpload(true);
                                                startLocalEdit();
                                            }}
                                        >
                                            <span className="material-symbols-outlined !text-lg">add</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Add Reference Image</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )
                )}
            </TableCell>

            {/* Actions */}
            <TableCell className={`align-top text-right px-1 ${isEditing ? "py-1" : "py-3"}`}>
                <RowActions
                    status={isGenerating ? 'Generating' : (item.status === 'Error' ? 'Error' : ((item.refImageUrl && (item.refImageUrl.startsWith('http') || item.refImageUrl.startsWith('/'))) ? 'Done' : ''))}
                    resultUrl={item.refImageUrl}
                    isEditing={isEditing}
                    isSaving={saving}
                    onEditStart={startLocalEdit}
                    onEditSave={handleLocalSave}
                    onEditCancel={onCancelEdit}
                    onGenerate={() => onGenerate && onGenerate(item)}
                    onDownload={async () => onDownload(item.refImageUrl, item.name)}
                    onDelete={handleDeleteClick}
                    onDuplicate={() => onDuplicate && onDuplicate(item.id)}
                    className="items-end"
                    alignStatus="right"
                    data-testid="row-actions"
                />
            </TableCell>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="border-destructive/50 bg-stone-900 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Item?</AlertDialogTitle>
                        <AlertDialogDescription className="text-stone-400">
                            Are you sure you want to delete this library item? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row items-center justify-end gap-2">
                        <Button variant="ghost" onClick={confirmDelete} className="text-stone-400 hover:text-destructive hover:bg-destructive/10">Delete</Button>
                        <Button variant="default" onClick={() => setShowDeleteDialog(false)} className="bg-white text-black hover:bg-stone-200">Cancel</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </TableRow>
    );
}
