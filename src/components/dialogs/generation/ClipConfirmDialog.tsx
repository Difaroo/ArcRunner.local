
import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ClipConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    count: number;
    model: string;
    style: string;
    aspectRatio: string;
    onConfirm: () => void;
}

export function ClipConfirmDialog({
    open,
    onOpenChange,
    count,
    onConfirm,
    model,
    style,
    aspectRatio
}: ClipConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] border-stone-800 bg-stone-900 text-white p-6">
                <DialogHeader>
                    <DialogTitle>Generate Clips?</DialogTitle>
                    <DialogDescription className="text-stone-400">
                        This will queue generation for <span className="text-white font-bold">{count}</span> clips.
                    </DialogDescription>
                    <div className="grid grid-cols-2 gap-2 text-sm bg-black/20 p-3 rounded-md border border-white/5 mt-2">
                        <span className="text-stone-500">View</span>
                        <span className="text-right font-medium">{aspectRatio}</span>

                        <span className="text-stone-500">Style</span>
                        <span className="text-right font-medium truncate">{style || 'None'}</span>

                        <span className="text-stone-500">Model</span>
                        <span className="text-right font-medium truncate">{model}</span>
                    </div>
                </DialogHeader>
                <DialogFooter className="mt-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button variant="default" onClick={onConfirm} className="bg-orange-600 hover:bg-orange-700 text-white">
                        Confirm Generation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
