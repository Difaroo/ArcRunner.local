import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BatchGenerationDialog } from "./BatchGenerationDialog"
import { useState } from "react"
import { ListOrdered, Download, Clapperboard, Image as ImageIcon, Loader2 } from "lucide-react"
import { Clip } from "@/types"

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
    onAddClip: () => void
    clips: Clip[]
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
    onAspectRatioChange,
    onAddClip,
    clips
}: ActionToolbarProps) {
    const [showBatchDialog, setShowBatchDialog] = useState(false)
    const [isRenumbering, setIsRenumbering] = useState(false)

    // Determine if current model is image-based (Flux) or video-based (Veo)
    const isImageModel = selectedModel.toLowerCase().includes('flux')

    const handleRenumber = async () => {
        setIsRenumbering(true)
        try {
            // Logic: Sort first based on visual sort order
            const sortedClips = [...clips].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

            const updates: { id: string | number; scene: string }[] = []
            let sceneIndex = 0
            let clipIndex = 0
            let lastLocation = "___INITIAL___"

            for (const clip of sortedClips) {
                const currentLocation = (clip.location || "").trim()

                // If location changes or it's the very first clip (sceneIndex is 0), new scene
                // BUT: logic says "if row is first on list then SCN = 1.01".
                // So sceneIndex starts at 1.
                if (sceneIndex === 0) {
                    sceneIndex = 1
                    clipIndex = 1
                    lastLocation = currentLocation
                } else if (currentLocation !== lastLocation) {
                    sceneIndex++
                    clipIndex = 1
                    lastLocation = currentLocation
                } else {
                    clipIndex++
                }

                // Format: 1.01, 1.02, 2.01
                const newScene = `${sceneIndex}.${String(clipIndex).padStart(2, '0')}`

                if (clip.scene !== newScene) {
                    updates.push({ id: clip.id, scene: newScene })
                }
            }

            if (updates.length > 0) {
                const res = await fetch('/api/renumber', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updates })
                })
                if (!res.ok) throw new Error('Failed to renumber')

                window.location.reload()
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsRenumbering(false)
        }
    }

    return (
        <>
            <div className="flex items-center gap-4 py-1.5">
                <div className="flex gap-2 text-xs text-zinc-500 uppercase tracking-wider items-center">
                    <span className="text-zinc-900">Ep {currentEpKey}</span>
                    <span>{totalClips} Clips</span>
                </div>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline-primary" // User requested "Same style as New Row" (assumed custom variant or standard outline with primary colors)
                                size="icon"
                                onClick={handleRenumber}
                                disabled={isRenumbering || totalClips === 0}
                                className="h-8 w-8 ml-1"
                            >
                                {isRenumbering ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                ) : (
                                    <ListOrdered className="h-4 w-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Renumber Scenes by Location (1.01, 1.02...)</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="h-4 w-px bg-zinc-700"></div>

                {/* Model Selection */}
                <DropdownMenu>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                                        <span className="text-zinc-500 mr-2 font-semibold">MODEL</span>
                                        <span className="text-zinc-500 mr-2 font-semibold">MODEL</span>
                                        {selectedModel === 'veo-fast' ? 'Veo Fast' : selectedModel === 'veo-quality' ? 'Veo Quality' : selectedModel === 'veo-s2e' ? 'Veo S2E' : selectedModel === 'flux-pro' ? 'Flux Pro' : selectedModel === 'flux-flex' ? 'Flux Flex' : selectedModel === 'nano-banana-pro' ? 'Nano' : 'Model'}
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
                        <DropdownMenuItem onClick={() => onModelChange('veo-s2e')} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                            Veo S2E (Start-to-End)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onModelChange('flux-pro')} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                            Flux Pro (Image)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onModelChange('flux-flex')} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                            Flux Flex (Image)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onModelChange('nano-banana-pro')} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                            Nano Banana Pro
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Aspect Ratio Selection (Renamed to VIEW) */}
                <DropdownMenu>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white ml-2">
                                        <span className="text-zinc-500 mr-2 font-semibold">VIEW</span>
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
                                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white ml-2 flex items-center gap-2">
                                        <span className="text-zinc-500 font-semibold">STYLE</span>
                                        <span className="truncate max-w-[100px] inline-block align-bottom">{currentStyle || 'Select...'}</span>
                                        {currentStyle && (
                                            <div
                                                role="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onStyleChange('');
                                                }}
                                                className="hover:bg-zinc-600 rounded-full h-4 w-4 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined !text-[14px]">close</span>
                                            </div>
                                        )}
                                        <span className="material-symbols-outlined !text-sm text-zinc-500">expand_more</span>
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


                <div className="h-4 w-px bg-zinc-700"></div>

                {/* --- RIGHT GROUP: Actions --- */}
                <div className="flex items-center gap-2">

                    {/* Selected Count */}
                    <span className={`text-xs font-medium uppercase transition-colors mr-1 ${selectedCount > 0 ? "text-primary" : "text-zinc-600"}`}>
                        {selectedCount} SELECTED
                    </span>

                    {/* Generate Button opens Dialog */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="icon"
                                    onClick={onGenerateSelected}
                                    disabled={selectedCount === 0}
                                    className="h-8 w-8 shadow-[0_0_10px_rgba(255,255,255,0.05)] hover:shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-shadow"
                                    variant="default" // Using default (likely orange primary)
                                    data-testid="generate-selected-button"
                                >
                                    {isImageModel ? (
                                        <span className="material-symbols-outlined !text-lg">image</span>
                                    ) : (
                                        <span className="material-symbols-outlined !text-lg">movie_creation</span>
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isImageModel ? "Generate images for selected clips" : "Generate video for selected clips"}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Download Button Icon Only - Square */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline-primary" // User requested consistent style
                                    size="icon"
                                    onClick={onDownloadSelected}
                                    disabled={selectedCount === 0}
                                    className="h-8 w-8"
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Download generated videos</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>


                    <div className="h-4 w-px bg-zinc-700 mx-2"></div>

                    {/* New Clip Button */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline-primary"
                                    size="icon"
                                    onClick={onAddClip}
                                    className="h-8 w-8 hover:!bg-primary/20"
                                    data-testid="add-button"
                                >
                                    <span className="material-symbols-outlined !text-lg">add</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Add New Scene</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

            </div>

            {/* Internal Batch Dialog REMOVED to restore Page-level control */}
            {/* 
            <BatchGenerationDialog
                open={showBatchDialog}
                onOpenChange={setShowBatchDialog}
                onConfirm={onGenerateSelected}
                count={selectedCount}
                model={selectedModel}
                ratio={aspectRatio}
                style={currentStyle}
            /> 
            */}
        </>
    )
}
