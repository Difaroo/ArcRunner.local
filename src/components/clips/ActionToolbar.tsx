import { Button } from "@/components/ui/button"

interface ActionToolbarProps {
    currentEpKey: string
    totalClips: number
    readyClips: number
    selectedCount: number
    onGenerateSelected: () => void
    onDownloadSelected: () => void
}

export function ActionToolbar({
    currentEpKey,
    totalClips,
    readyClips,
    selectedCount,
    onGenerateSelected,
    onDownloadSelected
}: ActionToolbarProps) {
    return (
        <div className="flex items-center gap-3 py-2">
            <div className="flex gap-2 text-xs text-zinc-500 uppercase tracking-wider items-center mr-4 border-r border-zinc-200 pr-4 h-6">
                <span className="font-semibold text-zinc-900">Ep {currentEpKey}</span>
                <span>{totalClips} Clips</span>
                <span>{readyClips} Ready</span>
            </div>
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
                className="h-8 px-3 text-xs"
            >
                <span className="material-symbols-outlined !text-sm mr-2">download</span>
                Download
            </Button>
        </div>
    )
}
