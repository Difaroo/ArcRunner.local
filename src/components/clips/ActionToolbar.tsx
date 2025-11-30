import { Button } from "@/components/ui/button"
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
}

export function ActionToolbar({
    currentEpKey,
    totalClips,
    readyClips,
    selectedCount,
    onGenerateSelected,
    onDownloadSelected,
    selectedModel,
    onModelChange
}: ActionToolbarProps) {
    return (
        <div className="flex items-center gap-3 py-2">
            <div className="flex gap-2 text-xs text-zinc-500 uppercase tracking-wider items-center mr-4 border-r border-zinc-200 pr-4 h-6">
                <span className="font-semibold text-zinc-900">Ep {currentEpKey}</span>
                <span>{totalClips} Clips</span>
                <span>{selectedCount} Selected</span>
                <span>{selectedCount} Selected</span>
            </div>

            {/* Model Selection */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                        <span className="text-zinc-500 mr-2 font-semibold">MODEL</span>
                        {selectedModel === 'veo-fast' ? 'Veo Fast' : 'Veo Quality'}
                        <span className="material-symbols-outlined !text-sm ml-2">expand_more</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40 bg-stone-900 border-stone-800 text-white">
                    <DropdownMenuItem onClick={() => onModelChange('veo-fast')} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                        Veo Fast
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onModelChange('veo-quality')} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                        Veo Quality
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-4 w-px bg-zinc-700 mx-2"></div>

            <Button
                size="sm"
                onClick={onGenerateSelected}
                disabled={selectedCount === 0}
                className="h-8 px-3 text-xs"
            >
                <span className="material-symbols-outlined !text-sm mr-2">movie_creation</span>
                Generate ({selectedCount})
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={onDownloadSelected}
                disabled={selectedCount === 0}
                className="h-8 px-3 text-xs border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary"
            >
                <span className="material-symbols-outlined !text-sm mr-2">download</span>
                Download
            </Button>
        </div>
    )
}
