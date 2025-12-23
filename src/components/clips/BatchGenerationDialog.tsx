import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface BatchGenerationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
    count: number
    model: string
    ratio: string
    style: string
}

export function BatchGenerationDialog({
    open,
    onOpenChange,
    onConfirm,
    count,
    model,
    ratio,
    style
}: BatchGenerationDialogProps) {
    const isImageModel = model.toLowerCase().includes('flux')
    const type = isImageModel ? 'Images' : 'Videos'
    // Grammar fix: determine singular or plural unit string
    const unit = isImageModel
        ? (count === 1 ? 'image' : 'images')
        : (count === 1 ? 'video' : 'videos')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] p-6 bg-stone-950 border-stone-800">
                <DialogHeader>
                    <DialogTitle className="text-primary">Batch Generate {type}</DialogTitle>
                    <div className="pt-4 pb-6 space-y-3 text-sm text-stone-300">
                        <p>
                            You will generate <span className="font-bold text-white">{count}</span> {unit} using <span className="font-bold text-white">{model}</span>.
                        </p>
                        <div className="flex flex-col gap-1">
                            <p>Viewport: <span className="font-bold text-white">{ratio}</span></p>
                            <p>Style: <span className="font-bold text-white">{style || 'None'}</span></p>
                        </div>
                        <p className="pt-2 text-stone-400 italic">
                            Confirm generate details before proceeding.
                        </p>
                    </div>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={() => {
                        onConfirm()
                        onOpenChange(false)
                    }}>
                        Start Generation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
