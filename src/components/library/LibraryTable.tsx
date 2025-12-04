import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export interface LibraryItem {
    id: string; // Added ID (index)
    type: string;
    name: string;
    description: string;
    refImageUrl: string;
    negatives: string;
    notes: string;
    episode: string;
}

interface LibraryTableProps {
    items: LibraryItem[];
    onSave: (index: string, updates: Partial<LibraryItem>) => void;
}

export function LibraryTable({ items, onSave }: LibraryTableProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<LibraryItem>>({});
    const [saving, setSaving] = useState(false);

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
        <div className="w-full h-full overflow-auto">
            <Table>
                <TableHeader className="sticky top-0 bg-black backdrop-blur-sm z-10">
                    <TableRow>
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
                            <TableCell colSpan={8} className="h-24 text-center text-stone-500">
                                No library items found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map((item, index) => {
                            const isEditing = editingId === item.id;
                            return (
                                <TableRow key={index} className="group hover:bg-black transition-colors">
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
                                                <Textarea
                                                    value={editValues.description || ''}
                                                    onChange={e => handleChange('description', e.target.value)}
                                                    className="min-h-[60px] text-xs bg-stone-900 border-stone-700 text-white w-full"
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
                                    <TableCell className="align-top py-3 text-right">
                                        <EditableCell isEditing={isEditing} onStartEdit={() => handleStartEdit(item)}>
                                            <ImageUploadCell
                                                value={isEditing ? editValues.refImageUrl || '' : item.refImageUrl || ''}
                                                onChange={(url) => handleChange('refImageUrl', url)}
                                                isEditing={isEditing}
                                            />
                                        </EditableCell>
                                    </TableCell>

                                    {/* Actions */}
                                    <TableCell className="align-top py-3 text-right">
                                        {isEditing && (
                                            <div className="flex justify-end gap-2">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                onClick={handleSave}
                                                                disabled={saving}
                                                                className="h-8 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                                                            >
                                                                {saving ? '...' : 'Save'}
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
                                                                className="btn-icon-action"
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
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
