import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { LibraryRow } from "./LibraryRow";

import { LibraryItem } from '@/lib/library';

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

        try {
            // Determine extension or default
            const ext = url.split('.').pop()?.split('?')[0] || 'png';
            // Allow alphanumeric, spaces, underscores, and hyphens. Then trim.
            const sanitizedName = name.replace(/[^a-z0-9_\- ]/gi, '').trim();
            const filename = `${sanitizedName}.${ext}`;

            // Use the proxy to avoid CORS issues
            const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download file');
        }
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
                                    No library items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => {
                                const isEditing = editingId === item.id;
                                const isSelected = selectedItems.has(item.id);
                                const isItemGenerating = (isGenerating && isGenerating(item.id)) || (item.refImageUrl ? item.refImageUrl.startsWith('TASK:') : false);

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

