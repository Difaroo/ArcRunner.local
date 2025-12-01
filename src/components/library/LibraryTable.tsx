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

    const handleStartEdit = (item: LibraryItem, index: number) => {
        setEditingId(index.toString());
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

    const renderCell = (item: LibraryItem, index: number, field: keyof LibraryItem, content: React.ReactNode, className: string = "") => {
        const isEditing = editingId === index.toString();
        if (isEditing) return content;

        return (
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(item, index);
                }}
                className={`cursor-pointer hover:bg-stone-800/50 p-1 rounded -m-1 transition ${className}`}
                title="Click to edit"
            >
                {content}
            </div>
        );
    };

    return (
        <div className="rounded-md border border-stone-800 bg-black/40 overflow-hidden">
            <Table>
                <TableHeader className="bg-black sticky top-0 z-10">
                    <TableRow className="border-stone-800 hover:bg-black">
                        <TableHead className="text-stone-500 w-[50px]">Ep</TableHead>
                        <TableHead className="text-stone-500 w-[150px]">Name</TableHead>
                        <TableHead className="text-stone-500 w-[100px]">Type</TableHead>
                        <TableHead className="text-stone-500">Description</TableHead>
                        <TableHead className="text-stone-500 w-[150px]">Negatives</TableHead>
                        <TableHead className="text-stone-500 w-[150px]">Notes</TableHead>
                        <TableHead className="text-stone-500 w-[120px] text-right">Ref Image</TableHead>
                        <TableHead className="w-24"></TableHead>
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
                            const isEditing = editingId === index.toString();
                            return (
                                <TableRow key={index} className="border-stone-800 hover:bg-black group transition-colors">
                                    <TableCell className="font-mono text-xs text-stone-500 align-top py-3">
                                        {item.episode}
                                    </TableCell>

                                    {/* Name */}
                                    <TableCell className="align-top py-3">
                                        {renderCell(item, index, 'name',
                                            isEditing ? (
                                                <Input
                                                    value={editValues.name || ''}
                                                    onChange={e => handleChange('name', e.target.value)}
                                                    className="h-8 text-xs bg-stone-900 border-stone-700 text-white"
                                                />
                                            ) : (
                                                <span className="font-medium text-white text-sm">{item.name}</span>
                                            )
                                        )}
                                    </TableCell>

                                    {/* Type Dropdown */}
                                    <TableCell className="align-top py-3">
                                        {renderCell(item, index, 'type',
                                            isEditing ? (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-[10px] px-2 text-left truncate border-stone-700 bg-stone-900 text-stone-300">
                                                            {editValues.type?.replace('LIB_', '') || "Select..."}
                                                        </Button>
                                                    </DropdownMenuTrigger>
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
                                            )
                                        )}
                                    </TableCell>

                                    {/* Description */}
                                    <TableCell className="align-top py-3">
                                        {renderCell(item, index, 'description',
                                            isEditing ? (
                                                <Textarea
                                                    value={editValues.description || ''}
                                                    onChange={e => handleChange('description', e.target.value)}
                                                    className="min-h-[60px] text-xs bg-stone-900 border-stone-700 text-white"
                                                />
                                            ) : (
                                                <span className="text-white text-sm whitespace-pre-wrap leading-relaxed">{item.description}</span>
                                            )
                                        )}
                                    </TableCell>

                                    {/* Negatives */}
                                    <TableCell className="align-top py-3">
                                        {renderCell(item, index, 'negatives',
                                            isEditing ? (
                                                <Input
                                                    value={editValues.negatives || ''}
                                                    onChange={e => handleChange('negatives', e.target.value)}
                                                    className="h-8 text-xs bg-stone-900 border-stone-700 text-white"
                                                />
                                            ) : (
                                                <span className="text-white text-sm">{item.negatives}</span>
                                            )
                                        )}
                                    </TableCell>

                                    {/* Notes */}
                                    <TableCell className="align-top py-3">
                                        {renderCell(item, index, 'notes',
                                            isEditing ? (
                                                <Input
                                                    value={editValues.notes || ''}
                                                    onChange={e => handleChange('notes', e.target.value)}
                                                    className="h-8 text-xs bg-stone-900 border-stone-700 text-white italic"
                                                />
                                            ) : (
                                                <span className="text-white text-sm italic">{item.notes}</span>
                                            )
                                        )}
                                    </TableCell>

                                    {/* Ref Image */}
                                    <TableCell className="align-top py-3 text-right">
                                        {renderCell(item, index, 'refImageUrl',
                                            isEditing ? (
                                                <Input
                                                    value={editValues.refImageUrl || ''}
                                                    onChange={e => handleChange('refImageUrl', e.target.value)}
                                                    className="h-8 text-xs bg-stone-900 border-stone-700 text-white"
                                                    placeholder="Image URL"
                                                />
                                            ) : (
                                                item.refImageUrl ? (
                                                    <div className="relative w-24 h-32 rounded-md overflow-hidden border border-stone-700 bg-stone-900 ml-auto">
                                                        <img
                                                            src={`/api/proxy-image?url=${encodeURIComponent(item.refImageUrl)}`}
                                                            alt={item.name}
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-24 h-32 bg-transparent rounded border border-white/10 flex items-center justify-center text-stone-500 text-xs ml-auto">
                                                        -
                                                    </div>
                                                )
                                            )
                                        )}
                                    </TableCell>

                                    {/* Actions */}
                                    <TableCell className="align-top py-3 text-right">
                                        {isEditing && (
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={handleSave}
                                                    disabled={saving}
                                                    className="h-8 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                                                >
                                                    {saving ? '...' : 'Save'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={handleCancelEdit}
                                                    className="h-8 w-8 border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary"
                                                >
                                                    <span className="material-symbols-outlined !text-lg">close</span>
                                                </Button>
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
