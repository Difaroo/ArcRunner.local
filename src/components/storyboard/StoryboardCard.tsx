
import { Clip } from "@/types"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from "lucide-react"
import { MediaDisplay } from "@/components/media/MediaDisplay"

interface StoryboardCardProps {
    clip: Clip
    onToggleHide: (clipId: string, hidden: boolean) => void
    printLayout?: '3x2' | '6x1' | 'auto'
}

export function StoryboardCard({ clip, onToggleHide, printLayout = '3x2' }: StoryboardCardProps) {
    const isHidden = clip.isHiddenInStoryboard;



    if (printLayout === '6x1') {
        return (
            <div className={`flex gap-4 p-2 border-b border-gray-200 break-inside-avoid print:flex-row items-start ${isHidden ? 'print:hidden' : ''} print:portrait-list-item`}>
                {/* 1. Thumbnail Column */}
                <div className="w-[160px] flex-shrink-0">
                    <div className={`aspect-video w-full rounded overflow-hidden border border-black bg-white ${isHidden ? 'opacity-50 grayscale' : ''}`}>
                        {clip.thumbnailPath || clip.resultUrl ? (
                            <MediaDisplay
                                url={clip.thumbnailPath || clip.resultUrl!}
                                originalUrl={clip.resultUrl || undefined}
                                model={clip.model || ''}
                                title={clip.title || clip.scene || 'Clip'}
                                // onPlay removed to use internal modal
                                isThumbnail={!!clip.thumbnailPath}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                <span className="material-symbols-outlined text-4xl text-gray-300">movie</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Scene Info Column */}
                <div className="w-12 font-mono text-xs font-bold pt-1 text-black">
                    {clip.scene}
                </div>

                {/* 3. Action Column */}
                <div className="flex-1 text-xs font-sans pt-1 text-black leading-relaxed">
                    {clip.action || clip.title || "No description."}
                </div>

                {/* 4. Dialog Column */}
                <div className="flex-1 text-xs font-sans pt-1 text-black leading-relaxed border-l border-gray-200 pl-4">
                    {clip.dialog && (
                        <span>&quot;{clip.dialog}&quot;</span>
                    )}
                </div>

                {/* Hide Toggle (Screen only) */}
                <div className="print:hidden">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onToggleHide(clip.id.toString(), !isHidden)}
                        className={`h-6 w-6 ${isHidden ? 'text-stone-600' : 'text-stone-400 hover:text-primary'}`}
                    >
                        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
        )
    }

    // Default 3x2 / Screen Card Layout
    return (
        <div
            className={`flex flex-col gap-2 p-4 break-inside-avoid print:p-0 ${isHidden ? 'print:hidden' : ''} print:portrait-list-item`}
        >
            {/* Header: Scene # and Hide Toggle */}
            <div className="flex justify-between items-center mb-2 gap-2">
                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                    <span className={`font-mono text-xs font-bold flex-shrink-0 ${isHidden ? 'text-stone-600' : 'text-stone-500'}`}>
                        {clip.scene}
                    </span>
                    <span className={`text-xs font-sans truncate ${isHidden ? 'text-stone-600' : 'text-stone-400'}`} title={clip.title || ''}>
                        {clip.title}
                    </span>
                </div>
                <div className="flex items-center gap-2 print:hidden flex-shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onToggleHide(clip.id.toString(), !isHidden)}
                        className={`h-6 w-6 hover:bg-white/5 ${isHidden ? 'text-stone-600 hover:text-stone-400' : 'text-primary hover:text-primary/80 hover:bg-primary/10'}`}
                        title={isHidden ? "Show in Print" : "Hide from Print"}
                    >
                        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            {/* Media Thumbnail */}
            <div className={`aspect-video w-full rounded overflow-hidden mb-2 print:border print:border-black bg-transparent print:!bg-white ${isHidden ? 'opacity-50 grayscale' : ''}`}>
                {clip.thumbnailPath || clip.resultUrl ? (
                    <MediaDisplay
                        url={clip.thumbnailPath || clip.resultUrl!}
                        originalUrl={clip.resultUrl || undefined}
                        model={clip.model || ''}
                        title={clip.title || clip.scene || 'Clip'}
                        // onPlay removed to use internal modal
                        isThumbnail={!!clip.thumbnailPath}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-700 bg-transparent print:!bg-white print:!bg-none [print-color-adjust:economy]">
                        <span className="material-symbols-outlined text-4xl print:hidden opacity-20">movie</span>
                    </div>
                )}
            </div>

            {/* Action Description */}
            <div className={`text-xs leading-relaxed font-sans mt-1 print:text-black ${isHidden ? 'text-stone-600' : 'text-stone-300'}`}>
                {clip.action || clip.title || "No description provided."}
            </div>

            {/* Dialog (Hidden in Landscape 3x2 Print) */}
            {clip.dialog && (
                <div className={`mt-2 text-xs font-sans print:text-stone-600 ${isHidden ? 'text-stone-700' : 'text-stone-400'} ${printLayout === '3x2' ? 'print:hidden' : ''}`}>
                    &quot;{clip.dialog}&quot;
                </div>
            )}
        </div>
    )
}
