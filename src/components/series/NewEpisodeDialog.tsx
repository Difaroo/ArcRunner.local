import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";

interface NewEpisodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NewEpisodeDialog({ open, onOpenChange }: NewEpisodeDialogProps) {
    const { currentSeriesId, refreshData } = useStore();
    const [newEpNumber, setNewEpNumber] = useState("");
    const [newEpTitle, setNewEpTitle] = useState("");
    const [isCreatingEpisode, setIsCreatingEpisode] = useState(false);

    const handleCreateEpisode = async () => {
        if (!newEpNumber || !newEpTitle) return;
        setIsCreatingEpisode(true);
        try {
            const res = await fetch('/api/create_episode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seriesId: currentSeriesId,
                    number: parseInt(newEpNumber),
                    title: newEpTitle
                })
            });

            if (!res.ok) throw new Error("Failed to create episode");

            await refreshData(); // Refresh to see new episode
            onOpenChange(false);
            setNewEpNumber("");
            setNewEpTitle("");
        } catch (e) {
            console.error(e);
            alert("Failed to create episode");
        } finally {
            setIsCreatingEpisode(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-stone-900 border-stone-800 text-stone-100 p-6">
                <DialogHeader><DialogTitle>New Episode</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Episode Number</label>
                        <Input value={newEpNumber} onChange={e => setNewEpNumber(e.target.value)} placeholder="e.g. 2" className="bg-stone-950 border-stone-800" />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Title</label>
                        <Input value={newEpTitle} onChange={e => setNewEpTitle(e.target.value)} placeholder="The Awakening" className="bg-stone-950 border-stone-800" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleCreateEpisode} disabled={isCreatingEpisode}>
                        {isCreatingEpisode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
