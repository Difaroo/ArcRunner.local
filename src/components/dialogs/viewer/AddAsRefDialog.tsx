import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useState, useRef, useEffect, useMemo } from "react"
import { Loader2 } from "lucide-react"
import { Clip } from "@/types"

interface AddAsRefDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    imageUrl: string
    clips: Clip[]
    onCopy: (targetClipId: string) => Promise<void>
    onMove: (targetClipId: string) => Promise<void>
}

interface GroupedClip {
    episode: string
    clips: Clip[]
}

export function AddAsRefDialog({
    open,
    onOpenChange,
    imageUrl,
    clips,
    onCopy,
    onMove
}: AddAsRefDialogProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const listRef = useRef<HTMLDivElement>(null)

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setSearchQuery("")
            setSelectedIndex(0)
            setError(null)
        }
    }, [open])

    // Sort and group clips by episode
    const groupedClips = useMemo(() => {
        // Sort by episode number, then scene number
        const sorted = [...clips].sort((a, b) => {
            // episode is an object (relation) from Prisma: { number: int, ... }
            const epNumA = (a as any).episode?.number || 1;
            const epNumB = (b as any).episode?.number || 1;

            if (epNumA !== epNumB) return epNumA - epNumB

            const sceneA = parseFloat(a.scene || '0') || 0
            const sceneB = parseFloat(b.scene || '0') || 0
            return sceneA - sceneB
        })

        // Group by episode
        const groups: Map<string, Clip[]> = new Map()
        sorted.forEach(clip => {
            const epNum = (clip as any).episode?.number || 1;
            const epKey = epNum.toString();

            if (!groups.has(epKey)) groups.set(epKey, [])
            groups.get(epKey)!.push(clip)
        })

        return Array.from(groups.entries()).map(([episode, clips]) => ({
            episode,
            clips
        }))
    }, [clips])

    // Filter clips based on search
    const filteredClips = useMemo(() => {
        if (!searchQuery.trim()) return groupedClips

        const query = searchQuery.toLowerCase()
        return groupedClips
            .map(group => ({
                ...group,
                clips: group.clips.filter(clip =>
                    (clip.scene || '').toLowerCase().includes(query) ||
                    (clip.title || '').toLowerCase().includes(query) ||
                    (clip.character || '').toLowerCase().includes(query) ||
                    (clip.location || '').toLowerCase().includes(query)
                )
            }))
            .filter(group => group.clips.length > 0)
    }, [groupedClips, searchQuery])

    // Flat list of visible clips for keyboard navigation
    const flatClips = useMemo(() =>
        filteredClips.flatMap(g => g.clips),
        [filteredClips]
    )

    // Clamp selection when list changes
    useEffect(() => {
        if (selectedIndex >= flatClips.length) {
            setSelectedIndex(Math.max(0, flatClips.length - 1))
        }
    }, [flatClips.length, selectedIndex])

    // Scroll selected item into view
    useEffect(() => {
        const selected = listRef.current?.querySelector('[data-selected="true"]')
        selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, [selectedIndex])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, flatClips.length - 1))
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
                break
            case 'Enter':
                e.preventDefault()
                if (flatClips[selectedIndex]) {
                    handleAction(flatClips[selectedIndex].id, 'copy') // Default to copy on Enter
                }
                break
            case 'Escape':
                e.preventDefault()
                onOpenChange(false)
                break
        }
    }

    const handleAction = async (clipId: string, action: 'copy' | 'move') => {
        setLoading(true)
        setError(null)
        try {
            if (action === 'copy') {
                await onCopy(clipId)
            } else {
                await onMove(clipId)
            }
            onOpenChange(false)
        } catch (e: any) {
            setError(e.message || `Failed to ${action} reference`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[500px] bg-stone-950 border-stone-800 text-stone-100 p-6 max-h-[80vh] flex flex-col"
                onKeyDown={handleKeyDown}
            >
                <DialogHeader className="gap-2">
                    <DialogTitle className="text-stone-100 font-normal text-xl">Add as ref image</DialogTitle>
                    <DialogDescription className="text-stone-400">
                        Add this image as a reference in clip.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4 flex-1 min-h-0">
                    {/* Search Input */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="clipSearch" className="text-stone-300 font-normal">
                            Add to clip
                        </Label>
                        <Input
                            id="clipSearch"
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setSelectedIndex(0)
                            }}
                            placeholder="Search by scene, title, character, or location..."
                            className="bg-stone-900 border-stone-700 text-white h-9"
                            autoFocus
                        />
                    </div>

                    {/* Clip List */}
                    <div
                        ref={listRef}
                        className="flex-1 overflow-y-auto rounded border border-stone-800 bg-stone-900/50 max-h-[300px]"
                    >
                        {filteredClips.length === 0 ? (
                            <div className="p-4 text-center text-stone-500 text-sm">
                                {searchQuery ? 'No clips match your search' : 'No clips available'}
                            </div>
                        ) : (
                            filteredClips.map((group, groupIdx) => (
                                <div key={group.episode}>
                                    {/* Episode Divider */}
                                    <div className="sticky top-0 bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-400 border-b border-stone-700">
                                        Episode {group.episode}
                                    </div>

                                    {/* Clips in Episode */}
                                    {group.clips.map((clip) => {
                                        const globalIndex = flatClips.findIndex(c => c.id === clip.id)
                                        const isSelected = globalIndex === selectedIndex

                                        return (
                                            <div
                                                key={clip.id}
                                                data-selected={isSelected}
                                                onClick={() => setSelectedIndex(globalIndex)}
                                                className={`px-3 py-2 cursor-pointer transition-colors flex items-center gap-3 ${isSelected
                                                    ? 'bg-primary/20 text-primary'
                                                    : 'hover:bg-stone-800 text-stone-300'
                                                    }`}
                                            >
                                                <span className="font-mono text-sm text-stone-500 w-12 flex-shrink-0">
                                                    {clip.scene || '—'}
                                                </span>
                                                <span className="flex-1 truncate text-sm">
                                                    {clip.title || 'Untitled'}
                                                </span>
                                                {clip.character && (
                                                    <span className="text-xs text-stone-500 truncate max-w-[100px]">
                                                        {clip.character}
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ))
                        )}
                    </div>

                    {error && (
                        <p className="text-destructive text-sm text-center bg-destructive/10 p-2 rounded">
                            {error}
                        </p>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                        className="text-stone-400 hover:text-white hover:bg-stone-800"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => flatClips[selectedIndex] && handleAction(flatClips[selectedIndex].id, 'move')}
                        disabled={loading || flatClips.length === 0}
                        className="text-orange-500 border-orange-500 hover:bg-orange-500/10 hover:text-orange-400 min-w-[100px]"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Move
                    </Button>
                    <Button
                        onClick={() => flatClips[selectedIndex] && handleAction(flatClips[selectedIndex].id, 'copy')}
                        disabled={loading || flatClips.length === 0}
                        className="bg-primary text-black hover:bg-primary/90 font-medium min-w-[100px]"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Copy
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
