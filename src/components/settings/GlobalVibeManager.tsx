'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Edit2, Save, X } from 'lucide-react'; // Removed Plus

interface Vibe {
    id: string;
    title: string;
    prompt: string;
    type: string;
    seriesId: string | null;
}

interface GlobalVibeManagerProps {
    type?: 'CAMERA' | 'MOVEMENT' | 'ACTION'; // Optional filter
}

export interface GlobalVibeManagerHandle {
    openCreateModal: () => void;
}

export const GlobalVibeManager = forwardRef<GlobalVibeManagerHandle, GlobalVibeManagerProps>(({ type: filterType }, ref) => {
    const [vibes, setVibes] = useState<Vibe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Vibe>>({});

    // Create Form
    const [isCreating, setIsCreating] = useState(false);
    const [newVibe, setNewVibe] = useState({ title: '', prompt: '', type: (filterType || 'CAMERA') as string });

    useImperativeHandle(ref, () => ({
        openCreateModal: () => setIsCreating(true)
    }));


    const fetchVibes = async () => {
        setIsLoading(true);
        try {
            // Fetch ONLY globals (no seriesId param), optionally filtered by type
            // Add timestamp and no-store to ensure fresh data
            const url = filterType
                ? `/api/vibes?type=${filterType}&t=${Date.now()}`
                : `/api/vibes?t=${Date.now()}`;

            const res = await fetch(url, { cache: 'no-store' });

            if (res.ok) {
                const data = await res.json();
                setVibes(data);
            } else {
                console.error(`[GlobalVibeManager] Fetch failed: ${res.status}`);
            }
        } catch (error) {
            console.error('[GlobalVibeManager] Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVibes();
        // Reset creating state when type changes
        setIsCreating(false);
        setNewVibe({ title: '', prompt: '', type: filterType || 'CAMERA' });
    }, [filterType]);

    const handleCreate = async () => {
        try {
            await fetch('/api/vibes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newVibe,
                    type: filterType || newVibe.type, // Ensure type is correct if filtered
                    seriesId: null // Force global
                })
            });
            setIsCreating(false);
            setNewVibe({ title: '', prompt: '', type: filterType || 'CAMERA' });
            fetchVibes();
        } catch (error) {
            console.error('Failed to create', error);
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            await fetch('/api/vibes', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...editForm })
            });
            setEditingId(null);
            fetchVibes();
        } catch (error) {
            console.error('Failed to update', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this global vibe?')) return;
        try {
            await fetch('/api/vibes', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            fetchVibes();
        } catch (error) {
            console.error('Failed to delete', error);
        }
    };

    const startEdit = (vibe: Vibe) => {
        setEditingId(vibe.id);
        setEditForm({ title: vibe.title, prompt: vibe.prompt, type: vibe.type });
    };

    // If filtered, we don't need to group, just show the list.
    // But keeping the grouping logic is fine, it will just be one group.
    const groupedVibes = vibes.reduce((acc, vibe) => {
        if (!acc[vibe.type]) acc[vibe.type] = [];
        acc[vibe.type].push(vibe);
        return acc;
    }, {} as Record<string, Vibe[]>);

    return (
        <div className="flex flex-col gap-6 h-full overflow-hidden">
            {/* Header removed as it's now in SettingsPage */}
            {/* Create Form */}
            {isCreating && (
                <div className="bg-stone-900 border border-stone-800 p-4 rounded-lg flex flex-col gap-3">
                    <h4 className="text-sm font-semibold text-white">New {filterType ? filterType.toLowerCase() : 'Global'} Item</h4>
                    <div className="grid grid-cols-4 gap-3">
                        {!filterType && (
                            <div className="col-span-1">
                                <select
                                    className="w-full h-9 bg-stone-950 border border-stone-800 rounded px-2 text-xs text-white"
                                    value={newVibe.type}
                                    onChange={e => setNewVibe({ ...newVibe, type: e.target.value })}
                                >
                                    <option value="CAMERA">CAMERA</option>
                                    <option value="MOVEMENT">MOVEMENT</option>
                                    <option value="ACTION">ACTION</option>
                                </select>
                            </div>
                        )}
                        <div className={filterType ? "col-span-1" : "col-span-1"}>
                            <Input
                                placeholder="Title"
                                value={newVibe.title}
                                onChange={e => setNewVibe({ ...newVibe, title: e.target.value })}
                                className="h-9"
                            />
                        </div>
                        <div className={filterType ? "col-span-3" : "col-span-2"}>
                            <Input
                                placeholder="Prompt"
                                value={newVibe.prompt}
                                onChange={e => setNewVibe({ ...newVibe, prompt: e.target.value })}
                                className="h-9"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleCreate}>Create</Button>
                    </div>
                </div>
            )}

            {/* Content List */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-8">
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-stone-500" /></div>
                ) : (
                    Object.entries(groupedVibes).map(([type, items]) => (
                        <div key={type} className="space-y-3">
                            {/* Only show header if mixed types (no filter) */}
                            {!filterType && (
                                <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
                                    <Badge variant="outline" className="text-primary border-primary/30">{type}</Badge>
                                </div>
                            )}

                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-stone-800">
                                        <TableHead className="w-[200px]">Title</TableHead>
                                        <TableHead>Prompt</TableHead>
                                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map(vibe => (
                                        <TableRow key={vibe.id} className="border-stone-800 hover:bg-stone-900/50">
                                            {editingId === vibe.id ? (
                                                <>
                                                    <TableCell>
                                                        <Input
                                                            value={editForm.title}
                                                            onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                                            className="h-8 text-xs"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={editForm.prompt}
                                                            onChange={e => setEditForm({ ...editForm, prompt: e.target.value })}
                                                            className="h-8 text-xs"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500" onClick={() => handleUpdate(vibe.id)}>
                                                                <Save className="w-3 h-3" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-stone-500" onClick={() => setEditingId(null)}>
                                                                <X className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <>
                                                    <TableCell className="font-medium text-xs text-white">{vibe.title}</TableCell>
                                                    <TableCell className="text-xs text-stone-400">{vibe.prompt}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-stone-500 hover:text-white" onClick={() => startEdit(vibe)}>
                                                                <Edit2 className="w-3 h-3" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-stone-500 hover:text-red-500" onClick={() => handleDelete(vibe.id)}>
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ))
                )}
                {!isLoading && vibes.length === 0 && (
                    <div className="text-center text-stone-500 py-10">
                        No {filterType ? filterType.toLowerCase() : 'global'} vibes found.
                    </div>
                )}
            </div>
        </div>
    );
});

GlobalVibeManager.displayName = "GlobalVibeManager";
