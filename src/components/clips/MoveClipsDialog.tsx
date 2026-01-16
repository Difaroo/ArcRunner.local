
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { Loader2 } from "lucide-react"

interface MoveClipsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedCount: number
    onConfirm: (episodeNumber: number) => Promise<void>
}

export function MoveClipsDialog({
    open,
    onOpenChange,
    selectedCount,
    onConfirm
}: MoveClipsDialogProps) {
    const [episodeNum, setEpisodeNum] = useState<string>("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleConfirm = async () => {
        if (!episodeNum) return;
        setLoading(true);
        setError(null);
        try {
            await onConfirm(parseInt(episodeNum));
            // Don't close here, wait for parent to reload or close
            onOpenChange(false);
        } catch (e: any) {
            setError(e.message || "Failed to move clips");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-stone-950 border-stone-800 text-stone-100 p-6">
                <DialogHeader className="gap-2">
                    <DialogTitle className="text-stone-100 font-normal text-xl">Move to Episode</DialogTitle>
                    <DialogDescription className="text-stone-400">
                        Move {selectedCount} selected clips to another episode.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <div className="flex items-center gap-4">
                        <Label htmlFor="epNum" className="text-stone-300 font-normal whitespace-nowrap">
                            Move to episode number
                        </Label>
                        <Input
                            id="epNum"
                            type="number"
                            value={episodeNum}
                            onChange={(e) => setEpisodeNum(e.target.value)}
                            className="w-[80px] bg-stone-900 border-stone-700 text-white text-center h-9"
                            autoFocus
                            placeholder="#"
                        />
                    </div>
                    {error && <p className="text-destructive text-sm text-center bg-destructive/10 p-2 rounded">{error}</p>}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading} className="text-stone-400 hover:text-white hover:bg-stone-800">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={loading || !episodeNum}
                        className="bg-primary text-black hover:bg-primary/90 font-medium min-w-[140px]"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Move to Episode
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    )
}
