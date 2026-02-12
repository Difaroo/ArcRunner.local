import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Vibe {
    id: string;
    title: string;
    prompt: string;
    type: string;
    seriesId: string | null;
}

interface VibeItemProps {
    vibe: Vibe;
    onSelect: () => void;
    onUpdate: (updates: Partial<Vibe> & { id: string }) => Promise<void>;
}

export function VibeItem({ vibe, onSelect, onUpdate }: VibeItemProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editedTitle, setEditedTitle] = useState(vibe.title);
    const [editedPrompt, setEditedPrompt] = useState(vibe.prompt);
    const [isSaving, setIsSaving] = useState(false);

    const isGlobal = !vibe.seriesId;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsSaving(true);
        try {
            await onUpdate({ id: vibe.id, title: editedTitle, prompt: editedPrompt });
            setIsOpen(false);
        } catch (error) {
            console.error(error);
            alert("Failed to save vibe changes.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="group w-full flex items-center gap-1 pr-1 rounded hover:bg-stone-800 transition-colors">
            {/* Main Select Action */}
            <button
                onClick={onSelect}
                className="flex-1 px-2 py-1.5 text-left overflow-hidden"
            >
                <div className="flex items-center gap-2">


                    <span className={`text-[11px] truncate font-light ${isGlobal ? 'text-primary' : 'text-white'}`}>{vibe.title}</span>
                    {/* Visual Indicator of Type if needed, or just prompt preview */}
                </div>
                <span className="text-[10px] text-stone-500 block truncate font-light opacity-70 group-hover:opacity-100 transition-opacity">
                    {vibe.prompt.slice(0, 50)}...
                </span>
            </button>

            {/* Edit Trigger (Visible on Hover) */}
            <Popover open={isOpen} onOpenChange={(open) => {
                if (open) {
                    // Reset on Open
                    setEditedTitle(vibe.title);
                    setEditedPrompt(vibe.prompt);
                }
                setIsOpen(open);
            }}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 hover:text-white hover:bg-stone-700"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className="material-symbols-outlined !text-[14px]">edit</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 bg-stone-900 border-stone-800 p-3" side="right" align="start">
                    <form onSubmit={handleSave} className="flex flex-col gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-stone-500 font-medium tracking-wider">Title</label>
                            <Input
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                className="h-7 text-xs bg-stone-950 border-stone-800 text-white"
                                placeholder="Vibe Title"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-stone-500 font-medium tracking-wider">Prompt</label>
                            <textarea
                                value={editedPrompt}
                                onChange={(e) => setEditedPrompt(e.target.value)}
                                className="w-full h-32 p-2 rounded-md bg-stone-950 border border-stone-800 text-xs text-white resize-none focus:outline-none focus:ring-1 focus:ring-stone-700 leading-relaxed custom-scrollbar"
                                placeholder="Enter prompt..."
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsOpen(false)}
                                className="h-7 text-xs hover:bg-stone-800 text-stone-400"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={isSaving}
                                className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </form>
                </PopoverContent>
            </Popover>
        </div>
    );
}
