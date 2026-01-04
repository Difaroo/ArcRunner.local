
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Series } from '@/types';

interface AddSeriesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAddSeries: (title: string) => Promise<void>;
}

export function AddSeriesDialog({ open, onOpenChange, onAddSeries }: AddSeriesDialogProps) {
    const [title, setTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setTitle("");
            setError(null);
            setLoading(false);
        }
    }, [open]);

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setLoading(true);
        setError(null);
        try {
            await onAddSeries(title);
            // Parent handles closing on success usually, or we do it here if promise resolves
        } catch (e: any) {
            setError(e.message || "Failed to add series");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] border-stone-800 bg-stone-900 text-white p-6 grid gap-4">
                <DialogHeader>
                    <DialogTitle>Add New Series</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Series Title"
                        disabled={loading}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmit();
                        }}
                    />
                    {error && (
                        <p className="text-xs text-destructive flex items-center gap-2">
                            <span className="material-symbols-outlined !text-sm">error</span>
                            {error}
                        </p>
                    )}
                </div>
                <DialogFooter className="mt-2">
                    <Button
                        onClick={() => onOpenChange(false)}
                        variant="ghost"
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!title.trim() || loading}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Adding...' : 'Add Series'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
