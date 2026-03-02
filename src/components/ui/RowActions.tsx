import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2 } from "lucide-react"
import { useState } from "react"

interface RowActionsProps {
    status: string
    resultUrl?: string
    isEditing: boolean
    isSaving?: boolean
    onEditStart: () => void
    onEditSave: () => void
    onEditCancel: () => void
    onGenerate: () => void
    onDownload: () => Promise<void>
    onDelete?: () => void
    onDuplicate?: () => void
    onOpenBEM?: () => void // Open Batch Edit Modal for this clip
    className?: string
    alignStatus?: 'left' | 'right' | 'center'
    'data-testid'?: string
    isPersisted?: boolean // NEW: Visual feedback for persistence
    isImageModel?: boolean // NEW: Video/Image model icon toggle
}

export function RowActions({
    status,
    resultUrl,
    isEditing,
    isSaving,
    onEditStart,
    onEditSave,
    onEditCancel,
    onGenerate,
    onDownload,
    onDelete,
    onDuplicate,
    onOpenBEM,
    className,
    alignStatus = 'left',
    'data-testid': dataTestId,
    isPersisted, // Destructure new prop
    isImageModel // Destructure new prop
}: RowActionsProps) {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownloadClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            await onDownload();
        } finally {
            setIsDownloading(false);
        }
    };

    // EDIT MODE
    if (isEditing) {
        return (
            <div className={`flex flex-col gap-1 ${className || 'items-center'}`} data-testid={`${dataTestId}-edit`}>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline-success"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); onEditSave(); }}
                                disabled={isSaving}
                                className="h-8 w-8"
                                data-testid="save-button"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined !text-lg">check</span>}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Save changes</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>



                {onDuplicate && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline-warning"
                                    size="icon"
                                    onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                                    className="h-8 w-8"
                                >
                                    <span className="material-symbols-outlined !text-lg">add</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Duplicate Row</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline-destructive"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }}
                                className="h-8 w-8"
                            >
                                <span className="material-symbols-outlined !text-lg">close</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Delete Row</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        )
    }

    // VIEW MODE
    const isDone = (status === 'Done' || status === 'Ready' || status?.startsWith('Saved')) && resultUrl;
    const isGenerating = status === 'Generating';
    const isError = status?.startsWith('Error') || status === 'Upload Err' || status === 'File 404' || status === 'Net Err';

    return (
        <div className={`flex flex-col gap-0.5 relative z-50 pointer-events-auto ${className || 'items-start'}`} data-testid={dataTestId}>
            <div className={`flex flex-col gap-0.5 ${className || 'items-start'}`}>

                {/* 1. BEM BUTTON (Always first in view mode) */}
                {onOpenBEM && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => { e.stopPropagation(); onOpenBEM(); }}
                                    className="h-8 w-8 !text-primary hover:!bg-primary/20 transition-all duration-300"
                                >
                                    <span className="material-symbols-outlined !text-lg" style={{ fontVariationSettings: "'wght' 200" }}>edit_note</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Open editor</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* 2. DOWNLOAD / PERSIST BUTTON (If Done) */}
                {isDone && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleDownloadClick}
                                    disabled={isSaving || isDownloading}
                                    className={`h-8 w-8 ${isPersisted ? '!text-green-500 hover:!text-green-400 hover:bg-green-500/10' : '!text-orange-500 hover:!text-orange-400 hover:bg-orange-500/10'}`}
                                >
                                    {isDownloading ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                                    ) : isPersisted ? (
                                        <span className="material-symbols-outlined !text-lg" style={{ fontVariationSettings: "'wght' 200" }}>folder</span>
                                    ) : (
                                        <span className="material-symbols-outlined !text-lg" style={{ fontVariationSettings: "'wght' 200" }}>download</span>
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{isPersisted ? "Re-download (Persisted)" : "Download (⌘S)"}</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* 3. GENERATE BUTTON (If Not Done/Generating) */}
                {(!isDone && !isGenerating) && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                                    className="h-8 w-8 !text-primary hover:!bg-red-500 transition-all duration-300"
                                >
                                    <span className="material-symbols-outlined !text-lg" style={{ fontVariationSettings: "'wght' 200" }}>{isImageModel ? 'image' : 'movie_creation'}</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Generate Asset</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* 3. GENERATING SPINNER (Click to Retry) */}
                {isGenerating && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={(e) => { e.stopPropagation(); if (confirm('Restart generation?')) onGenerate(); }}
                                    className="h-8 w-8 p-0 border-primary/50 bg-primary/10 hover:bg-red-900/20 hover:border-red-500 transition-colors"
                                >
                                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Generating... Click to Restart</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>

            {/* STATUS TEXT - Centered */}
            <div className={`text-[10px] text-stone-500 font-light w-full text-center flex flex-col items-center`}>
                {isDone ? (
                    <span className="text-stone-500 block">
                        {status?.startsWith('Saved') ? status : 'Ready'}
                    </span>
                ) : null}
                {isGenerating && <span className="text-primary/70 block">Gen...</span>}
                {isError && (
                    <span className="text-destructive font-medium block leading-tight">
                        Error
                        {/* Show Details/Code if available */}
                        {status.replace(/^(Error|Err)[:\s]*/i, '') && (
                            <>
                                <span className="block h-[1px]"></span>
                                <span className="text-[9px] font-normal opacity-90 inline-block">
                                    {status.replace(/^(Error|Err)[:\s]*/i, '')}
                                </span>
                            </>
                        )}
                    </span>
                )}
            </div>
        </div>
    )
}
