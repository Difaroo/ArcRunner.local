import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ImageUploadCell } from "@/components/ui/ImageUploadCell";
import { EditableCell } from "@/components/ui/EditableCell";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { LibraryActionToolbar } from "./LibraryActionToolbar";

export interface LibraryItem {
    id: string; // Added ID (index)
    type: string;
    name: string;
    description: string;
    refImageUrl: string;
    negatives: string;
    notes: string;
    episode: string;
    series?: string; // Add series support for filtering if needed
}

interface LibraryTableProps {
    items: LibraryItem[];
    onSave: (index: string, updates: Partial<LibraryItem>) => void;
    currentSeriesId?: string; // Optional context
    selectedItems: Set<string>;
    onSelect: (id: string) => void;
    onSelectAll: () => void;
    onGenerate?: (item: LibraryItem) => void;
    isGenerating?: (id: string) => boolean;
}

export function LibraryTable({ items, onSave, currentSeriesId, selectedItems, onSelect, onSelectAll, onGenerate, isGenerating }: LibraryTableProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<LibraryItem>>({});
    const [saving, setSaving] = useState(false);

    // Filter items by series if provided (though passed items should already be filtered)
    // We assume 'items' prop is already the correct list to display.

    const handleStartEdit = (item: LibraryItem) => {
        setEditingId(item.id);
        setEditValues({ ...item });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditValues({});
    };

    const handleSave = async () => {
        if (!editingId) return;
        setSaving(true);
        try {
            await onSave(editingId, editValues);
            setEditingId(null);
            setEditValues({});
        } catch (error) {
            console.error(error);
            alert('Failed to save library item');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof LibraryItem, value: string) => {
        setEditValues(prev => ({ ...prev, [field]: value }));
    };

    const LIBRARY_TYPES = ['LIB_CHARACTER', 'LIB_LOCATION', 'LIB_STYLE', 'LIB_CAMERA'];

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 overflow-auto">
                <Table>
                    <TableHeader className="bg-black backdrop-blur-sm z-10">
                        <TableRow>
                            <TableHead className="w-[40px] px-2 align-top py-3">
                                <Checkbox
                                    checked={items.length > 0 && selectedItems.size === items.length}
                                    onCheckedChange={onSelectAll}
                                    className="translate-y-[2px]"
                                />
                            </TableHead>
                            <TableHead className="w-[60px] font-semibold text-stone-500 text-left align-top py-3">EP</TableHead>
                            <TableHead className="w-[150px] font-semibold text-stone-500 text-left align-top py-3">NAME</TableHead>
                            <TableHead className="w-[100px] font-semibold text-stone-500 text-left align-top py-3">TYPE</TableHead>
                            <TableHead className="font-semibold text-stone-500 text-left align-top py-3">DESCRIPTION</TableHead>
                            <TableHead className="w-[150px] font-semibold text-stone-500 text-left align-top py-3">NEGATIVES</TableHead>
                            <TableHead className="w-[150px] font-semibold text-stone-500 text-left align-top py-3">NOTES</TableHead>
                            <TableHead className="w-[120px] font-semibold text-stone-500 text-left align-top py-3">REF IMG</TableHead>
                            <TableHead className="w-24 font-semibold text-stone-500 align-top py-3"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-stone-500">
                                    No library items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item, index) => {
                                const isEditing = editingId === item.id;
                                const isSelected = selectedItems.has(item.id);
                                return (
                                    <TableRow key={index} className={`group hover:bg-black transition-colors ${isEditing || isSelected ? 'bg-black' : ''}`}>
                                        <TableCell className="align-top py-3 px-2">
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => onSelect(item.id)}
                                            />
                                        </TableCell>

                                        <TableCell className="font-mono text-xs text-stone-500 align-top py-3">
                                            {item.episode}
                                        </TableCell>

                                        {/* Name */}
                                        <TableCell className={`align-top ${isEditing ? "p-1" : "py-3"}`}>
                                            <EditableCell isEditing={isEditing} onStartEdit={() => handleStartEdit(item)}>
                                                {isEditing ? (
                                                    <Input
                                                        value={editValues.name || ''}
                                                        onChange={e => handleChange('name', e.target.value)}
                                                        className="table-input h-full"
                                                    />
                                                ) : (
                                                    <span className="table-text font-medium">{item.name}</span>
                                                )}
                                            </EditableCell>
                                        </TableCell>

                                        {/* Type Dropdown */}
                                        <TableCell className={`align-top ${isEditing ? "p-1" : "py-3"}`}>
                                            <EditableCell isEditing={isEditing} onStartEdit={() => handleStartEdit(item)}>
                                                {isEditing ? (
                                                    <DropdownMenu>
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
                                            <EditableCell isEditing={isEditing} onStartEdit={() => handleStartEdit(item)}>
                                                {isEditing ? (
                                                    <AutoResizeTextarea
                                                        value={editValues.description || ''}
                                                        onChange={e => handleChange('description', e.target.value)}
                                                        className="min-h-[60px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-extralight leading-relaxed"
                                                    />
                                                ) : (
                                                    <span className="table-text whitespace-pre-wrap">{item.description}</span>
                                                )}
                                            </EditableCell>
                                        </TableCell>

                                        {/* Negatives */}
                                        <TableCell className={`align-top ${isEditing ? "p-1" : "py-3"}`}>
                                            <EditableCell isEditing={isEditing} onStartEdit={() => handleStartEdit(item)}>
                                                {isEditing ? (
                                                    <Input
                                                        value={editValues.negatives || ''}
                                                        onChange={e => handleChange('negatives', e.target.value)}
                                                        className="table-input h-full"
                                                    />
                                                ) : (
                                                    <span className="table-text">{item.negatives}</span>
                                                )}
                                            </EditableCell>
                                        </TableCell>

                                        {/* Notes */}
                                        <TableCell className={`align-top ${isEditing ? "p-1" : "py-3"}`}>
                                            <EditableCell isEditing={isEditing} onStartEdit={() => handleStartEdit(item)}>
                                                {isEditing ? (
                                                    <Input
                                                        value={editValues.notes || ''}
                                                        onChange={e => handleChange('notes', e.target.value)}
                                                        className="table-input italic h-full"
                                                    />
                                                ) : (
                                                    <span className="table-text italic">{item.notes}</span>
                                                )}
                                            </EditableCell>
                                        </TableCell>

                                        {/* Ref Image */}
                                        <TableCell className={`align-top ${isEditing ? "p-1" : "py-3"}`}>
                                            <EditableCell isEditing={isEditing} onStartEdit={() => handleStartEdit(item)}>
                                                <ImageUploadCell
                                                    value={isEditing ? editValues.refImageUrl || '' : item.refImageUrl || ''}
                                                    onChange={(url) => handleChange('refImageUrl', url)}
                                                    isEditing={isEditing}
                                                />
                                            </EditableCell>
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell className={`align-top text-right ${isEditing ? "p-1" : "py-3"}`}>
                                            {isEditing ? (
                                                <div className="flex justify-end gap-2">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={handleSave}
                                                                    disabled={saving}
                                                                    className="h-8 w-8 border-[0.5px] border-green-600/50 text-green-600 hover:bg-green-600/10 hover:text-green-600 hover:border-green-600"
                                                                >
                                                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined !text-lg">check</span>}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Save changes</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={handleCancelEdit}
                                                                    className="btn-icon-action h-8 w-8"
                                                                >
                                                                    <span className="material-symbols-outlined !text-lg">close</span>
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Cancel editing</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            ) : (
                                                // View Mode Actions
                                                <div className="flex justify-end gap-2">
                                                    {isGenerating && isGenerating(item.id) ? (
                                                        <Button
                                                            variant="outline"
                                                            disabled
                                                            className="h-8 w-8 p-0 border-primary/50 bg-primary/10"
                                                        >
                                                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                                        </Button>
                                                    ) : item.refImageUrl ? (
                                                        <>
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            onClick={() => window.open(item.refImageUrl, '_blank')}
                                                                            className="btn-icon-action h-8 w-8"
                                                                        >
                                                                            <span className="material-symbols-outlined !text-lg">play_arrow</span>
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>View Image</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            onClick={() => window.open(item.refImageUrl, '_blank')}
                                                                            className="btn-icon-action h-8 w-8"
                                                                        >
                                                                            <span className="material-symbols-outlined !text-lg">download</span>
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Download Image</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </>
                                                    ) : (
                                                        onGenerate && (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            onClick={() => onGenerate(item)}
                                                                            className="h-8 px-3 text-xs border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary font-normal border-[0.5px]"
                                                                        >
                                                                            GEN
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Generate Asset</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
