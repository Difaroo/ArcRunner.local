
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface LibraryActionToolbarProps {
    selectedCount: number
    onGenerateSelected: () => void
    onDownloadSelected: () => void
    currentStyle: string
    onStyleChange: (style: string) => void
    availableStyles: string[]
    onAddItem?: () => void
}

export function LibraryActionToolbar({
    selectedCount,
    onGenerateSelected,
    onDownloadSelected,
    currentStyle,
    onStyleChange,
    availableStyles,
    onAddItem
}: LibraryActionToolbarProps) {
    return (
        <div className="flex items-center gap-3 py-1.5">
            <div className="flex gap-2 text-xs text-zinc-500 uppercase tracking-wider items-center">
                <span>{selectedCount} Selected</span>
            </div>
            <div className="h-4 w-px bg-zinc-700 mx-2"></div>

            {/* Style Selection */}
            <DropdownMenu>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                                    <span className="text-zinc-500 mr-2 font-semibold">STYLE</span>
                                    <span className="truncate max-w-[100px] inline-block align-bottom">{currentStyle || 'Select...'}</span>
                                    <span className="material-symbols-outlined !text-sm ml-2">expand_more</span>
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Select a visual style for the episode</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto bg-stone-900 border-stone-800 text-white">
                    {availableStyles.map((style) => (
                        <DropdownMenuItem
                            key={style}
                            onClick={() => onStyleChange(style)}
                            className="focus:bg-stone-800 focus:text-white cursor-pointer"
                        >
                            {style}
                        </DropdownMenuItem>
                    ))}
                    {availableStyles.length === 0 && (
                        <div className="p-2 text-xs text-stone-500">No styles found in Studio</div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

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

            <div className="h-4 w-px bg-zinc-700 mx-2"></div>

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onAddItem}
                            className="h-8 w-8 text-primary border-primary hover:bg-primary/10 hover:text-primary hover:border-primary border-opacity-50 cursor-pointer"
                        >
                            <span className="material-symbols-outlined !text-lg">add</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Add New Studio Asset</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
}
