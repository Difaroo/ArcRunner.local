import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Clip, Series } from "@/app/api/clips/route"
import { Check, X } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"


interface SeriesPageProps {
    seriesList: Series[]
    currentSeriesId: string
    onSeriesChange: (id: string) => void

    onNavigateToEpisode: (seriesId: string, episodeId: string) => void
    clips: Clip[]
    episodes: { id: string, title: string }[]
    libraryItems: any[]
    videoPromptTemplate: string
    imagePromptTemplate: string
    onUpdateSeries?: (id: string, updates: Partial<Series>) => void
    onRefresh?: (silent?: boolean) => void
}

export function SeriesPage({
    seriesList,
    currentSeriesId,

    onSeriesChange,
    onNavigateToEpisode,
    clips,
    episodes,
    libraryItems,
    videoPromptTemplate,
    imagePromptTemplate,
    onRefresh,
    onUpdateSeries
}: SeriesPageProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<'video' | 'image'>('video')

    useEffect(() => {
        console.log("SeriesPage Mounted")
    }, [])

    // Derived States
    const [videoPrompt, setVideoPrompt] = useState("")
    const [imagePrompt, setImagePrompt] = useState("")

    const [overallStyle, setOverallStyle] = useState("") // Editable field
    // Optimistic Model State


    const [copyMessage, setCopyMessage] = useState<string | null>(null)
    const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null)

    const handleUpdateEpisode = async (episodeId: string, newNumber: string, newTitle: string) => {
        try {
            const updates: any = {}
            if (newNumber && newNumber !== episodeId) updates.number = parseInt(newNumber)
            if (newTitle) updates.title = newTitle

            if (Object.keys(updates).length > 0) {
                const res = await fetch('/api/update_episode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        seriesId: currentSeriesId,
                        episodeId: episodeId,
                        updates
                    })
                })

                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Failed to update')

                router.refresh()
                setEditingEpisodeId(null)
            } else {
                setEditingEpisodeId(null)
            }
        } catch (error) {
            console.error(error)
            alert('Failed to update episode.')
        } finally {
            // setEditingEpisodeId(null) // Done in reload or above
        }
    }

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
        const status = clip.status || '';
        if (status.startsWith('Saved')) {
            data.savedCount++
        } else if (status === 'Done') {
            data.readyCount++
        }
    })

    // Generate Merged Prompts
    useEffect(() => {
        const generate = (template: string) => {
            if (!template) return ""
            let merged = template
            merged = merged.replace(/{{SERIES_TITLE}}/g, currentSeries?.title || '')
            merged = merged.replace(/{{SERIES_STYLE}}/g, overallStyle)

            // Generate Library Keys
            const keys = libraryItems
                .filter(item => item.series === currentSeriesId)
                .map(item => `- ${item.name} (${item.type})`)
                .join('\n')

            merged = merged.replace(/{{LIBRARY_KEYS}}/g, keys)
            return merged
        }

        setVideoPrompt(generate(videoPromptTemplate))
        setImagePrompt(generate(imagePromptTemplate))

    }, [videoPromptTemplate, imagePromptTemplate, currentSeries, overallStyle, libraryItems, currentSeriesId])




    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopyMessage("Copied!")
        setTimeout(() => setCopyMessage(null), 2000)
    }

    // Sort episodes
    const sortedEpisodes = [...episodes].sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
        return numA - numB;
    })

    return (
        <div className="flex flex-col h-full">


            <div className="flex-1 flex overflow-hidden">
                {/* LH Column: Episode Table */}
                <div className="w-1/2 border-r border-white/5 flex flex-col bg-stone-900/30">

                    <div className="flex-1 overflow-auto p-4">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-white/5">
                                    <TableHead className="w-16 text-xs font-semibold text-stone-500">EP #</TableHead>
                                    <TableHead className="text-xs font-semibold text-stone-500">TITLE</TableHead>
                                    <TableHead className="text-xs w-1/2 font-semibold text-stone-500">CLIPS / GENERATED / SAVED</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedEpisodes.map(ep => {
                                    const data = progressMap.get(ep.id) || { count: 0, savedCount: 0, readyCount: 0 }
                                    const totalGenerated = data.savedCount + data.readyCount

                                    // Progress bar percentages (relative to TOTAL clips)
                                    const generatedProgress = data.count > 0 ? Math.round((totalGenerated / data.count) * 100) : 0
                                    const savedProgress = data.count > 0 ? Math.round((data.savedCount / data.count) * 100) : 0

                                    const isEditing = editingEpisodeId === ep.id

                                    return (
                                        <TableRow
                                            key={ep.id}
                                            className="border-white/5 hover:bg-white/5 group cursor-pointer transition-colors"
                                            onClick={() => {
                                                if (!isEditing) onNavigateToEpisode(currentSeriesId, ep.id)
                                            }}
                                        >
                                            <TableCell className="text-xs text-stone-400 w-16" onClick={(e) => e.stopPropagation()}>
                                                {isEditing ? (
                                                    <Input
                                                        id={`ep-num-${ep.id}`}
                                                        className="table-input h-8 w-12 p-1 text-center bg-stone-950 border-stone-800"
                                                        defaultValue={ep.id}
                                                    />
                                                ) : (
                                                    <span
                                                        className="text-primary hover:text-primary/80 cursor-pointer font-bold transition-colors block w-full h-full"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setEditingEpisodeId(ep.id)
                                                        }}
                                                        title="Click to Edit"
                                                    >
                                                        {ep.id}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium text-xs text-white group-hover:text-primary transition-colors" onClick={(e) => isEditing && e.stopPropagation()}>
                                                {isEditing ? (
                                                    <Input
                                                        id={`ep-title-${ep.id}`}
                                                        className="h-8 bg-stone-950 border-stone-800 text-xs"
                                                        defaultValue={ep.title}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const numInput = document.getElementById(`ep-num-${ep.id}`) as HTMLInputElement
                                                                const titleInput = document.getElementById(`ep-title-${ep.id}`) as HTMLInputElement
                                                                handleUpdateEpisode(ep.id, numInput.value, titleInput.value)
                                                            } else if (e.key === 'Escape') {
                                                                setEditingEpisodeId(null)
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    ep.title
                                                )}
                                            </TableCell>
                                            <TableCell onClick={(e) => isEditing && e.stopPropagation()}>
                                                {isEditing ? (
                                                    <div className="flex items-center justify-end gap-2 pr-2">
                                                        <Button
                                                            size="icon"
                                                            variant="outline-success"
                                                            className="h-8 w-8"
                                                            onClick={() => {
                                                                const numInput = document.getElementById(`ep-num-${ep.id}`) as HTMLInputElement
                                                                const titleInput = document.getElementById(`ep-title-${ep.id}`) as HTMLInputElement
                                                                handleUpdateEpisode(ep.id, numInput.value, titleInput.value)
                                                            }}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="outline-destructive"
                                                            className="h-8 w-8"
                                                            onClick={() => setEditingEpisodeId(null)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                                                            <span>{data.count} / {totalGenerated} / {data.savedCount}</span>
                                                            <span>{savedProgress}%</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-black rounded-full overflow-hidden relative">
                                                            {/* Red Bar (Generated) */}
                                                            <div
                                                                className="absolute top-0 left-0 h-full bg-destructive opacity-70 rounded-full transition-all duration-500"
                                                                style={{ width: `${generatedProgress}%` }}
                                                            />
                                                            {/* Orange Bar (Saved) */}
                                                            <div
                                                                className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500"
                                                                style={{ width: `${savedProgress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
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
                <div className="flex-1 flex flex-col h-full border-l border-white/5">
                    <div className="flex flex-col h-full">
                        {/* Header Bar - Inline with Episodes Header */}
                        <div className="flex items-center justify-between px-4 border-b border-white/5 h-[53px] shrink-0 bg-stone-900/30 relative">
                            <h3 className="text-sm font-semibold text-stone-300">Episode Prompt</h3>

                            <div className="flex h-full bg-transparent p-0 gap-6 -mb-[1px]">
                                <button
                                    onClick={() => setActiveTab('video')}
                                    className={`nav-tab h-full rounded-none ${activeTab === 'video' ? 'active' : ''}`}
                                >
                                    Video
                                </button>
                                <button
                                    onClick={() => setActiveTab('image')}
                                    className={`nav-tab h-full rounded-none ${activeTab === 'image' ? 'active' : ''}`}
                                >
                                    Image
                                </button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">

                            <div className="flex flex-col gap-2 shrink-0">
                                <label className="text-xs text-stone-500 uppercase tracking-wider font-light">Overall Series Style / Instructions</label>
                                <Input
                                    value={overallStyle}
                                    onChange={(e) => setOverallStyle(e.target.value)}
                                    placeholder="e.g. Steampunk vibe, dark atmosphere..."
                                    className="bg-stone-900/50 border-stone-800 text-stone-300 text-xs h-9"
                                />
                            </div>

                            <div className="flex flex-col gap-2 shrink-0">
                                <label className="text-xs text-stone-500 uppercase tracking-wider font-light">Default Series Model</label>
                                <select
                                    key={currentSeriesId ? `${currentSeriesId}-model` : 'default-model'} // FORCE RESET on Series Change
                                    defaultValue={currentSeries?.defaultModel || 'veo-3'} // Only read on mount/key-change
                                    onChange={(e) => {
                                        const newModel = e.target.value
                                        if (currentSeriesId && onUpdateSeries) {
                                            onUpdateSeries(currentSeriesId, { defaultModel: newModel })
                                        }
                                    }}
                                    className="bg-stone-900/50 border border-stone-800 text-stone-300 text-xs h-9 rounded px-2 outline-none focus:border-stone-600"
                                >
                                    <option value="veo-3">Veo 3 (Video)</option>
                                    <option value="veo-fast">Veo Fast (Video)</option>
                                    <option value="flux-pro">Flux Pro (Image)</option>
                                    <option value="flux-flex">Flux Flex (Image)</option>
                                    <option value="nano-banana-pro">Nano Banana Pro (New)</option>
                                </select>
                            </div>

                            {activeTab === 'video' && (
                                <div className="flex-1 flex flex-col gap-2 min-h-0 mt-0">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs text-stone-500 uppercase tracking-wider font-light">Video Prompt</label>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="outline-primary"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(videoPrompt)}
                                                        className="h-6 text-[10px]"
                                                    >
                                                        <span className="material-symbols-outlined !text-xs mr-1">content_copy</span>
                                                        Copy
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Copy Video Prompt</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Textarea
                                        value={videoPrompt}
                                        readOnly
                                        className="flex-1 font-mono text-xs bg-stone-900/30 border-stone-800 text-stone-400 resize-none p-4 leading-relaxed h-full"
                                    />
                                </div>
                            )}

                            {activeTab === 'image' && (
                                <div className="flex-1 flex flex-col gap-2 min-h-0 mt-0">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs text-stone-500 uppercase tracking-wider font-light">Image Prompt</label>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="outline-primary"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(imagePrompt)}
                                                        className="h-6 text-[10px]"
                                                    >
                                                        <span className="material-symbols-outlined !text-xs mr-1">content_copy</span>
                                                        Copy
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Copy Image Prompt</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Textarea
                                        value={imagePrompt}
                                        readOnly
                                        className="flex-1 font-mono text-xs bg-stone-900/30 border-stone-800 text-stone-400 resize-none p-4 leading-relaxed h-full"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>



        </div>
    )
}
