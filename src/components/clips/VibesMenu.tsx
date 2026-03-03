import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { VibeItem } from './VibeItem';

interface StudioAsset {
    id: number;
    name: string;
    type: string;
    thumbnailPath?: string;
}

interface Vibe {
    id: string;
    title: string;
    prompt: string;
    type: string;
    sortOrder: number;
    seriesId: string | null;
}

interface VibesMenuProps {
    seriesId: string;
    episodeId?: string;
    activeField: 'character' | 'location' | 'camera' | 'movement' | 'action' | 'dialog' | 'media';
    onSelectVibe: (vibeId: string | null, value: string) => void;
    onStudioAssetClick: (name: string, type: string) => void;
    refreshTrigger?: number; // Prop trigger for live updates
    model: string;
}

function SortableVibeItem({ vibe, onSelect, onUpdate }: { vibe: Vibe, onSelect: () => void, onUpdate: (v: any) => Promise<void> }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: vibe.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <VibeItem vibe={vibe} onSelect={onSelect} onUpdate={onUpdate} />
        </div>
    );
}

export function VibesMenu({ seriesId, episodeId, activeField, onSelectVibe, onStudioAssetClick, refreshTrigger, model }: VibesMenuProps) {
    const [studioAssets, setStudioAssets] = useState<StudioAsset[]>([]);
    const [vibes, setVibes] = useState<Vibe[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (activeField === 'action') {
                    const res = await fetch(`/api/vibes?seriesId=${seriesId}&type=ACTION`);
                    if (res.ok) {
                        setVibes(await res.json());
                        setStudioAssets([]);
                    }
                } else {
                    const typeMap: Record<string, string> = {
                        character: 'LIB_CHARACTER',
                        location: 'LIB_LOCATION',
                        camera: 'LIB_CAMERA',
                        movement: 'LIB_MOVEMENT',
                        dialog: 'LIB_CHARACTER'
                    };
                    if (activeField === 'movement' || activeField === 'camera') {
                        const res = await fetch(`/api/vibes?seriesId=${seriesId}&type=${activeField.toUpperCase()}`);
                        if (res.ok) {
                            const data = await res.json();
                            setVibes(Array.isArray(data) ? data : []);
                            setStudioAssets([]);
                        }
                        return;
                    }
                    const assetType = typeMap[activeField];
                    if (assetType) {
                        const res = await fetch(`/api/library?seriesId=${seriesId}&type=${assetType}`);
                        if (res.ok) {
                            const data = await res.json();
                            setStudioAssets(Array.isArray(data) ? data : []);
                            setVibes([]);
                        }
                    }
                }
            } catch (err) {
                console.error('VibesMenu fetch error:', err);
                setError('Failed to load menu items');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [activeField, seriesId, episodeId, refreshTrigger]);

    const getMenuTitle = () => {
        const titles: Record<string, string> = {
            character: 'CHARACTERS',
            location: 'LOCATION',
            camera: 'CAMERA',
            movement: 'MOVEMENT',
            action: 'ACTION VIBES',
            dialog: 'CHARACTERS',
            media: 'EPISODE MEDIA'
        };
        return titles[activeField] || 'MENU';
    };

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="h-7 mb-1 shrink-0 flex items-center pl-2">
                <h3 className="text-xs text-primary uppercase tracking-wider font-normal">{getMenuTitle()}</h3>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-2">
                {isLoading && <div className="text-stone-500 text-sm">Loading...</div>}
                {error && <div className="text-destructive text-sm">{error}</div>}

                {!isLoading && studioAssets.length > 0 && (
                    <div className="space-y-1">
                        {studioAssets.map((asset) => (
                            <button key={asset.id} onClick={() => {
                                if (activeField === 'dialog') onSelectVibe(null, `[${asset.name}]: ""`);
                                else onStudioAssetClick(asset.name, asset.type.replace('LIB_', ''));
                            }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-stone-800 text-left transition-colors">
                                {asset.thumbnailPath && (
                                    <img src={asset.thumbnailPath.split(',')[0].trim()} alt={asset.name} className="w-8 h-8 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                )}
                                <span className="text-xs text-stone-300 truncate font-normal">{asset.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {!isLoading && vibes.length > 0 && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={async (event) => {
                        const { active, over } = event;
                        if (active.id !== over?.id) {
                            setVibes((items) => {
                                const oldIndex = items.findIndex((i) => i.id === active.id);
                                const newIndex = items.findIndex((i) => i.id === over?.id);
                                const newItems = arrayMove(items, oldIndex, newIndex);
                                const updates = newItems.map((item, index) => ({ id: item.id, sortOrder: index }));
                                fetch('/api/vibes/reorder', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: updates }) }).catch(console.error);
                                return newItems;
                            });
                        }
                    }}>
                        <SortableContext items={vibes.map(v => v.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-1">
                                {vibes.map((vibe) => (
                                    <SortableVibeItem key={vibe.id} vibe={vibe} onSelect={() => onSelectVibe(vibe.id, vibe.prompt)} onUpdate={async (updatedVibe) => {
                                        await fetch('/api/vibes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedVibe) });
                                        setVibes(prev => prev.map(v => v.id === updatedVibe.id ? { ...v, ...updatedVibe } : v));
                                    }} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}

                {!isLoading && studioAssets.length === 0 && vibes.length === 0 && (
                    <div className="text-stone-500 text-sm">No items found</div>
                )}
            </div>
        </div>
    );
}
