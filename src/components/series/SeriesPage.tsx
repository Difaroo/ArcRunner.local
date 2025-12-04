import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/PageHeader"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clip, Series } from "@/app/api/clips/route"

interface SeriesPageProps {
    seriesList: Series[]
    currentSeriesId: string
    onSeriesChange: (id: string) => void
    onAddSeries: (title: string) => void
    clips: Clip[]
    episodes: { id: string, title: string }[]
    libraryItems: any[] // For generating keys
    episodePromptTemplate: string
}

export function SeriesPage({
    seriesList,
    currentSeriesId,
    onSeriesChange,
    onAddSeries,
    clips,
    episodes,
    libraryItems,
    episodePromptTemplate
}: SeriesPageProps) {
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [newSeriesTitle, setNewSeriesTitle] = useState("")
    const [seriesPrompt, setSeriesPrompt] = useState("") // The merged prompt
    const [overallStyle, setOverallStyle] = useState("") // Editable field
    const [copyMessage, setCopyMessage] = useState<string | null>(null)

    const currentSeries = seriesList.find(s => s.id === currentSeriesId)

    // Calculate progress stats from clips
    const progressMap = new Map<string, { count: number, savedCount: number, readyCount: number }>()

    clips.forEach(clip => {
        const ep = clip.episode || '1'
        if (!progressMap.has(ep)) {
            progressMap.set(ep, { count: 0, savedCount: 0, readyCount: 0 })
        }
        const data = progressMap.get(ep)!
        data.count++
        if (clip.status === 'Saved') {
            data.savedCount++
        } else if (clip.status === 'Ready' || clip.status === 'Done') {
            data.readyCount++
        }
    })

    // Generate Merged Prompt
    useEffect(() => {
        if (!episodePromptTemplate) return

        let merged = episodePromptTemplate
        merged = merged.replace(/{{SERIES_TITLE}}/g, currentSeries?.title || '')
        merged = merged.replace(/{{SERIES_STYLE}}/g, overallStyle)

        // Generate Library Keys
        const keys = libraryItems
            .filter(item => item.series === currentSeriesId)
            .map(item => `- ${item.name} (${item.type})`)
            .join('\n')

        merged = merged.replace(/{{LIBRARY_KEYS}}/g, keys)

        setSeriesPrompt(merged)
    }, [episodePromptTemplate, currentSeries, overallStyle, libraryItems, currentSeriesId])


    const handleAdd = () => {
        if (newSeriesTitle.trim()) {
            onAddSeries(newSeriesTitle)
            setShowAddDialog(false)
            setNewSeriesTitle("")
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(seriesPrompt)
        setCopyMessage("Copied!")
        setTimeout(() => setCopyMessage(null), 2000)
    }

    // Sort episodes numerically (though input list might already be sorted, let's be safe)
    const sortedEpisodes = [...episodes].sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
        return numA - numB;
    })

    return (
        <div className="flex flex-col h-full">
            {/* Series Tabs */}
            {/* Series Tabs */}
            <div className="px-6 bg-black/20 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-6 -mb-px overflow-x-auto">
                    {seriesList.map(series => (
                        <button
                            key={series.id}
                            onClick={() => onSeriesChange(series.id)}
                            className={`py-3 text-sm font-normal transition-colors border-b-2 whitespace-nowrap ${currentSeriesId === series.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-stone-500 hover:text-stone-300 hover:border-stone-700'
                                }`}
                        >
                            {series.title}
                        </button>
                    ))}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setShowAddDialog(true)}
                                    className="py-3 text-primary hover:text-primary/80 transition-colors ml-2"
                                >
                                    <span className="material-symbols-outlined !text-lg">add</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Create a new Series</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* LH Column: Episode Table */}
                <div className="w-1/2 border-r border-white/5 flex flex-col bg-stone-900/30">
                    <div className="p-4 border-b border-white/5 shrink-0">
                        <h3 className="text-sm font-semibold text-stone-300">Episodes</h3>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-white/5">
                                    <TableHead className="w-16 text-xs">Ep #</TableHead>
                                    <TableHead className="text-xs">Title</TableHead>
                                    <TableHead className="text-xs w-1/2">Progress</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedEpisodes.map(ep => {
                                    const data = progressMap.get(ep.id) || { count: 0, savedCount: 0, readyCount: 0 }
                                    const totalCount = data.savedCount + data.readyCount

                                    const savedProgress = data.count > 0 ? Math.round((data.savedCount / data.count) * 100) : 0
                                    const totalProgress = data.count > 0 ? Math.round((totalCount / data.count) * 100) : 0

                                    return (
                                        <TableRow key={ep.id} className="border-white/5 hover:bg-white/5">
                                            <TableCell className="text-xs text-stone-400">{ep.id}</TableCell>
                                            <TableCell className="font-medium text-xs text-white">{ep.title}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex justify-between text-[10px] text-stone-400">
                                                        <span>{data.savedCount}/{data.count} Saved</span>
                                                        <span>{savedProgress}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-black rounded-full overflow-hidden relative">
                                                        {/* Pink Bar (Ready + Saved) - Background Layer */}
                                                        <div
                                                            className="absolute top-0 left-0 h-full bg-destructive opacity-70 rounded-full transition-all duration-500"
                                                            style={{ width: `${totalProgress}%` }}
                                                        />
                                                        {/* Orange Bar (Saved) - Foreground Layer */}
                                                        <div
                                                            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500"
                                                            style={{ width: `${savedProgress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {sortedEpisodes.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-xs text-stone-500 py-8">
                                            No episodes found for this series.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* RH Column: Prompts */}
                <div className="flex-1 flex flex-col bg-stone-950 h-full">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center shrink-0">
                        <h3 className="text-sm font-semibold text-stone-300">Episode Prompt</h3>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={copyToClipboard}
                                        className="h-7 text-xs border-primary/50 text-primary hover:text-primary hover:bg-primary/10"
                                    >
                                        <span className="material-symbols-outlined !text-sm mr-2">content_copy</span>
                                        Copy Prompt
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Copies the Episode prompt for making episode clips</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden h-full">
                        {/* Overall Style Field */}
                        <div className="flex flex-col gap-2 shrink-0">
                            <label className="text-xs text-stone-500 uppercase tracking-wider font-light">Overall Series Style / Instructions</label>
                            <Input
                                value={overallStyle}
                                onChange={(e) => setOverallStyle(e.target.value)}
                                placeholder="e.g. Steampunk vibe, dark atmosphere..."
                                className="bg-stone-900/50 border-stone-800 text-stone-300 text-xs h-9"
                            />
                        </div>

                        {/* Merged Prompt Display */}
                        <div className="flex-1 flex flex-col gap-2 min-h-0">
                            <label className="text-xs text-stone-500 uppercase tracking-wider font-light">Generated Prompt</label>
                            <Textarea
                                value={seriesPrompt}
                                readOnly
                                className="flex-1 font-mono text-xs bg-stone-900/30 border-stone-800 text-stone-400 resize-none p-4 leading-relaxed h-full"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Series Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Series</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={newSeriesTitle}
                            onChange={(e) => setNewSeriesTitle(e.target.value)}
                            placeholder="Series Title"
                        />
                    </div>
                    <DialogFooter>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={() => setShowAddDialog(false)} variant="ghost">Cancel</Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Cancel adding series</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={handleAdd}>Add Series</Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Confirm adding series</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
