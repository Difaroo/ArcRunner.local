
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface LibraryActionToolbarProps {
    selectedCount: number
    onGenerateSelected: () => void
    onDownloadSelected: () => void
}

export function LibraryActionToolbar({
    selectedCount,
    onGenerateSelected,
    onDownloadSelected,
}: LibraryActionToolbarProps) {
    return (
        <div className="flex items-center gap-3 py-1.5">
            <div className="flex gap-2 text-xs text-zinc-500 uppercase tracking-wider items-center">
                <span>{selectedCount} Selected</span>
            </div>
            <div className="h-4 w-px bg-zinc-700 mx-2"></div>

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="sm"
                            onClick={onGenerateSelected}
                            disabled={selectedCount === 0}
                            className="h-8 px-3 text-xs"
                        >
                            <span className="material-symbols-outlined !text-sm mr-2">image</span>
                            Generate ({selectedCount})
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Generate images for selected items</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onDownloadSelected}
                            disabled={selectedCount === 0}
                            className="h-8 px-3 text-xs border-primary border-opacity-50 text-primary hover:bg-primary hover:bg-opacity-10 hover:text-primary hover:border-primary disabled:text-primary disabled:text-opacity-50 disabled:border-opacity-30"
                        >
                            <span className="material-symbols-outlined !text-sm mr-2">download</span>
                            Download
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Download generated images</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
}
