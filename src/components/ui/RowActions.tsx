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
    className?: string
    alignStatus?: 'left' | 'right' | 'center'
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
    className,
    alignStatus = 'left'
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
            <div className={`flex flex-col gap-1 ${className || 'items-center'}`}>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline-success"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); onEditSave(); }}
                                disabled={isSaving}
                                className="h-8 w-8"
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
        <div className={`flex flex-col gap-1 relative z-50 pointer-events-auto ${className || 'items-start'}`}>
            <div className={`flex flex-col gap-2 ${className || 'items-start'}`}>

                {/* 1. DOWNLOAD BUTTON (If Done) */}
                {isDone && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline-primary"
                                    size="icon"
                                    onClick={handleDownloadClick}
                                    disabled={isSaving || isDownloading}
                                    className="h-8 w-8"
                                >
                                    {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined !text-lg">download</span>}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Download</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* 2. GENERATE BUTTON (If Not Done/Generating) */}
                {(!isDone && !isGenerating) && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline-primary"
                                    size="icon"
                                    onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                                    className="h-8 w-8 hover:!bg-red-500 transition-all duration-300"
                                >
                                    <span className="material-symbols-outlined !text-lg">auto_awesome</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Generate Asset</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* 3. GENERATING SPINNER */}
                {isGenerating && (
                    <Button
                        variant="outline"
                        disabled
                        className="h-8 w-8 p-0 border-primary/50 bg-primary/10"
                    >
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    </Button>
                )}
            </div>

            {/* STATUS TEXT */}
            <div className={`text-[10px] text-stone-500 font-medium w-full mt-1 text-${alignStatus}`}>
                {isDone ? (
                    <span className="text-stone-500 block">
                        {status?.startsWith('Saved') ? status : 'Ready'}
                    </span>
                ) : null}
                {isGenerating && <span className="text-primary/70 block">Gen...</span>}
                {isError && <span className="text-destructive block">{status}</span>}
            </div>
        </div>
    )
}
