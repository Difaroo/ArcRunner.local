
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface NewEpisodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreateEpisode: (title: string, number: string) => Promise<void>;
}

export function NewEpisodeDialog({ open, onOpenChange, onCreateEpisode }: NewEpisodeDialogProps) {
    const [title, setTitle] = useState("");
    const [number, setNumber] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setTitle("");
            setNumber("");
            setError(null);
            setLoading(false);
        }
    }, [open]);

    const handleSubmit = async () => {
        if (!title.trim() || !number.trim()) return;
        setLoading(true);
        try {
            await onCreateEpisode(title, number);
        } catch (e: any) {
            setError(e.message || "Failed to create episode");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] border-stone-800 bg-stone-900 text-white p-6 grid gap-4">
                <DialogHeader>
                    <DialogTitle>New Episode</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="number" className="text-right">
                            Number
                        </Label>
                        <Input
                            id="number"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            className="col-span-3 bg-stone-950 border-stone-800"
                            placeholder="e.g. 1"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="title" className="text-right">
                            Title
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="col-span-3 bg-stone-950 border-stone-800"
                            placeholder="Episode Title"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSubmit();
                            }}
                        />
                    </div>
                    {error && (
                        <p className="text-xs text-destructive flex items-center gap-2">
                            <span className="material-symbols-outlined !text-sm">error</span>
                            {error}
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        onClick={() => onOpenChange(false)}
                        variant="ghost"
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!title.trim() || !number.trim() || loading}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Creating...' : 'Create Episode'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
