
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { MODEL_LIST, getModelConfig } from "@/lib/models"
import { Fragment } from "react"

interface LibraryActionToolbarProps {
    totalItems: number
    selectedCount: number
    onGenerateSelected: () => void
    onDownloadSelected: () => void
    currentStyle: string
    onStyleChange: (style: string) => void
    availableStyles: string[]
    onAddItem?: () => void
    styleStrength: number
    onStyleStrengthChange: (val: number) => void
    // refStrength removed
    seed: number | null
    onSeedChange: (val: number | null) => void
    // New: Aspect Ratio (View)
    aspectRatio: string
    onAspectRatioChange: (ratio: string) => void
    // New: Model Logic
    selectedModel?: string | null
    onModelChange?: (model: string) => void
}

export function LibraryActionToolbar({
    totalItems,
    selectedCount,
    onGenerateSelected,
    onDownloadSelected,
    currentStyle,
    onStyleChange,
    availableStyles,
    onAddItem,
    styleStrength,
    onStyleStrengthChange,
    // refStrength removed
    seed,
    onSeedChange,
    aspectRatio,
    onAspectRatioChange,
    selectedModel,
    onModelChange
}: LibraryActionToolbarProps) {
    // Resolve model config for label display
    const currentModelId = selectedModel || 'flux-2/flex-image-to-image'; // Default to Flux
    const modelConfig = getModelConfig(currentModelId);
    return (
        <div className="flex items-center gap-4 py-1.5">
            <div className="flex gap-2 text-xs text-zinc-500 uppercase tracking-wider items-center">
                <span className="text-zinc-900">Studio</span>
                <span>{totalItems} Assets</span>
            </div>

            <div className="h-4 w-px bg-zinc-700"></div>

            {/* Central Control Group with Tighter Spacing */}
            <div className="flex items-center gap-2">

                {/* VIEW / RATIO SELECTION */}
                <DropdownMenu>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white mr-2">
                                        <span className="text-zinc-500 mr-2 font-semibold">VIEW</span>
                                        <span className="truncate inline-block align-bottom">{aspectRatio || '16:9'}</span>
                                        <span className="material-symbols-outlined !text-sm ml-2">expand_more</span>
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Aspect Ratio (View)</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <DropdownMenuContent className="w-24 bg-stone-900 border-stone-800 text-white">
                        {['16:9', '9:16', '1:1', '21:9', '4:3', '3:4'].map((ratio) => (
                            <DropdownMenuItem
                                key={ratio}
                                onClick={() => onAspectRatioChange(ratio)}
                                className="focus:bg-stone-800 focus:text-white cursor-pointer justify-center"
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
                    <DropdownMenuContent className="w-48 max-h-[300px] overflow-y-auto bg-stone-900 border-stone-800 text-white">
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


                {/* GUIDANCE (Style Pwr) */}
                <DropdownMenu>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                                        <span className="text-zinc-500 mr-2 font-semibold">STRENGTH</span>
                                        <span className="truncate inline-block align-bottom">{styleStrength}</span>
                                        <span className="material-symbols-outlined !text-sm ml-2">expand_more</span>
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Guidance Scale (1-10): How strictly to follow the text prompt.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <DropdownMenuContent className="w-16 max-h-[300px] overflow-y-auto bg-stone-900 border-stone-800 text-white min-w-[3rem]">
                        {/* Guidance often goes higher than 10 in Flux (20-30), but 1-10 is a safe start */}
                        {Array.from({ length: 15 }, (_, i) => i + 1).map((val) => (
                            <DropdownMenuItem
                                key={val}
                                onClick={() => onStyleStrengthChange(val)}
                                className="focus:bg-stone-800 focus:text-white cursor-pointer justify-center"
                            >
                                {val}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* PROMPT STRENGTH REMOVED per user request */}

                {/* SEED CONTROL */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 rounded border border-zinc-700 px-2 h-8 bg-background hover:bg-zinc-800/50 transition-colors">
                                <span className="text-xs text-zinc-500 font-semibold mr-1">SEED</span>
                                <input
                                    type="number"
                                    placeholder="Auto"
                                    className="bg-transparent text-xs w-[42px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    value={seed === null || seed === undefined ? '' : seed}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        // Robustness: Handle empty string or invalid number
                                        if (val === '') {
                                            onSeedChange(null);
                                        } else {
                                            const parsed = parseInt(val);
                                            if (!isNaN(parsed)) onSeedChange(parsed);
                                        }
                                    }}
                                />
                                {/* CLEAR BUTTON (Only if value exists) */}
                                {(seed !== null && seed !== undefined) && (
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-4 w-4 text-zinc-600 hover:text-red-400 -mr-1"
                                        onClick={() => onSeedChange(null)}
                                        title="Clear (Auto Random)"
                                    >
                                        <span className="material-symbols-outlined !text-[12px]">close</span>
                                    </Button>
                                )}

                                {/* RANDOMIZE BUTTON (Generates new number 1000-9999) */}
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-4 w-4 text-zinc-600 hover:text-zinc-300"
                                    onClick={() => onSeedChange(Math.floor(1000 + Math.random() * 9000))}
                                    title="Pick New Random Seed (4-digit)"
                                >
                                    <span className="material-symbols-outlined !text-[12px]">refresh</span>
                                </Button>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Seed: Set a number to lock the random noise. Clear for random.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>



                {/* MODEL SELECTION */}
                {onModelChange && (
                    <DropdownMenu>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white mr-2">
                                            <span className="text-zinc-500 mr-2 font-semibold">MODEL</span>
                                            {modelConfig?.label || "Select..."}
                                            <span className="material-symbols-outlined !text-sm ml-2">expand_more</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Select Generation Model (Applies to Selected)</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <DropdownMenuContent className="w-48 bg-stone-900 border-stone-800 text-white">
                            <DropdownMenuItem
                                onClick={() => onModelChange('default')}
                                className="text-xs text-stone-400 focus:bg-stone-800 focus:text-stone-300 italic"
                            >
                                Reset to Default
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-700/50" />
                            {MODEL_LIST.filter(m => m.isImage).map((model) => (
                                <DropdownMenuItem
                                    key={model.id}
                                    onClick={() => onModelChange(model.id)}
                                    className="focus:bg-stone-800 focus:text-white cursor-pointer"
                                >
                                    {model.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

            </div>

            <div className="h-4 w-px bg-zinc-700"></div>

            {/* --- RIGHT GROUP: Actions --- */}
            <div className="flex items-center gap-2">

                {/* Selected Count */}
                <span className={`text-xs font-medium uppercase transition-colors mr-1 ${selectedCount > 0 ? "text-primary" : "text-zinc-600"}`}>
                    <span className="font-bold">{selectedCount}</span>
                    <span className="ml-1.5">SELECTED</span>
                </span>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="icon"
                                onClick={onGenerateSelected}
                                disabled={selectedCount === 0}
                                className="h-8 w-8"
                            >
                                <span className="material-symbols-outlined !text-lg">image</span>
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
                                variant="outline-primary"
                                size="icon"
                                onClick={onDownloadSelected}
                                disabled={selectedCount === 0}
                                className="h-8 w-8"
                            >
                                <span className="material-symbols-outlined !text-lg">download</span>
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
                                variant="outline-primary"
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
        </div>
    )
}
