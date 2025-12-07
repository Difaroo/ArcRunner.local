import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ActionToolbarProps {
    currentEpKey: string
    totalClips: number
    readyClips: number
    selectedCount: number
    onGenerateSelected: () => void
    onDownloadSelected: () => void
    selectedModel: string
    onModelChange: (model: string) => void
    currentStyle: string
    onStyleChange: (style: string) => void
    availableStyles: string[]
    aspectRatio: string
    onAspectRatioChange: (ratio: string) => void
}

export function ActionToolbar({
    currentEpKey,
    totalClips,
    readyClips,
    selectedCount,
    onGenerateSelected,
    onDownloadSelected,
    selectedModel,
    onModelChange,
    currentStyle,
    onStyleChange,
    availableStyles,
    aspectRatio,
    onAspectRatioChange
}: ActionToolbarProps) {
    return (
        <div className="flex items-center gap-3 py-1.5">
            <div className="flex gap-2 text-xs text-zinc-500 uppercase tracking-wider items-center">
                <span className="font-semibold text-zinc-900">Ep {currentEpKey}</span>
                <span>{totalClips} Clips</span>
                <span>{selectedCount} Selected</span>
            </div>
            <div className="h-4 w-px bg-zinc-700 mx-2"></div>

            {/* Model Selection */}
            <DropdownMenu>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                                    <span className="text-zinc-500 mr-2 font-semibold">MODEL</span>
                                    {selectedModel === 'veo-fast' ? 'Veo Fast' : selectedModel === 'veo-quality' ? 'Veo Quality' : selectedModel === 'flux-pro' ? 'Flux Pro' : 'Flux Flex'}
                                    <span className="material-symbols-outlined !text-sm ml-2">expand_more</span>
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Select the AI model for video generation</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent className="w-40 bg-stone-900 border-stone-800 text-white">
                    <DropdownMenuItem onClick={() => onModelChange('veo-fast')} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                        Veo Fast
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onModelChange('veo-quality')} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                        Veo Quality
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onModelChange('flux-pro')} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                        Flux Pro (Image)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onModelChange('flux-flex')} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                        Flux Flex (Image)
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Aspect Ratio Selection */}
            <DropdownMenu>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white ml-2">
                                    <span className="text-zinc-500 mr-2 font-semibold">RATIO</span>
                                    {aspectRatio}
                                    <span className="material-symbols-outlined !text-sm ml-2">expand_more</span>
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Select Aspect Ratio</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent className="w-24 bg-stone-900 border-stone-800 text-white">
                    {['16:9', '9:16', '1:1', '21:9'].map((ratio) => (
                        <DropdownMenuItem
                            key={ratio}
                            onClick={() => onAspectRatioChange(ratio)}
                            className="focus:bg-stone-800 focus:text-white cursor-pointer"
                        >
                            {ratio}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Style Selection */}
            <DropdownMenu>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white ml-2">
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
                            <span className="material-symbols-outlined !text-sm mr-2">movie_creation</span>
                            Generate ({selectedCount})
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Generate video for selected clips</p>
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
                        <p>Download generated videos for selected clips</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    )
}
