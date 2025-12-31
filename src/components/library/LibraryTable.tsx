import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { LibraryRow } from "./LibraryRow";

import { LibraryItem } from '@/lib/library';
import { downloadFile } from '@/lib/download-utils';

interface LibraryTableProps {
    items: LibraryItem[];
    onSave: (index: string, updates: Partial<LibraryItem>) => void;
    currentSeriesId?: string; // Optional context
    selectedItems: Set<string>;
    onSelect: (id: string) => void;
    onSelectAll: () => void;
    onGenerate?: (item: LibraryItem) => void;
    isGenerating?: (id: string) => boolean;
    onPlay?: (url: string) => void;
    onDelete?: (id: string) => void;
    onDuplicate?: (id: string) => void;
}

export function LibraryTable({ items, onSave, currentSeriesId, selectedItems, onSelect, onSelectAll, onGenerate, isGenerating, onPlay, onDelete, onDuplicate }: LibraryTableProps) {
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleStartEdit = (item: LibraryItem) => {
        setEditingId(item.id);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
    };

    const handleSave = async (id: string, updates: Partial<LibraryItem>) => {
        await onSave(id, updates);
        setEditingId(null);
    };

    const handleDownload = async (url: string, name: string) => {
        if (!url || url.startsWith('TASK:')) return;

        // Determine extension or default
        const ext = url.split('.').pop()?.split('?')[0] || 'png';
        const filename = `${name}.${ext}`;

        await downloadFile(url, filename);
    };

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
                            <TableHead className="w-[105px] font-semibold text-stone-500 text-left align-top py-3">REF IMG</TableHead>
                            <TableHead className="w-[50px] font-semibold text-stone-500 align-top py-3"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-stone-500">
                                    No studio items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => {
                                const isEditing = editingId === item.id;
                                const isSelected = selectedItems.has(item.id);
                                const isItemGenerating = (isGenerating && isGenerating(item.id)) || (item.status === 'GENERATING') || (item.refImageUrl ? (item.refImageUrl.startsWith('TASK:') || item.refImageUrl.toLowerCase().includes('waiting')) : false);

                                return (
                                    <LibraryRow
                                        key={item.id}
                                        item={item}
                                        isSelected={isSelected}
                                        isEditing={isEditing}
                                        isGenerating={isItemGenerating}
                                        onSelect={onSelect}
                                        onStartEdit={handleStartEdit}
                                        onCancelEdit={handleCancelEdit}
                                        onSave={handleSave}
                                        onGenerate={onGenerate}
                                        onPlay={onPlay}
                                        onDownload={handleDownload}
                                        onDelete={onDelete}
                                        onDuplicate={onDuplicate}
                                    />
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

