import { Button } from "@/components/ui/button"

interface EpisodeTabsProps {
    episodeKeys: string[]
    currentEpisode: number
    episodeTitles: Record<string, string>
    onEpisodeChange: (ep: number) => void
}

export function EpisodeTabs({
    episodeKeys,
    currentEpisode,
    episodeTitles,
    onEpisodeChange
}: EpisodeTabsProps) {
    return (
        <nav className="flex items-center -mb-px overflow-x-auto">
            {episodeKeys.map((epKey, i) => (
                <button
                    key={epKey}
                    onClick={() => onEpisodeChange(i + 1)}
                    className={`border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${currentEpisode === i + 1
                            ? 'border-zinc-900 text-zinc-900'
                            : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
                        }`}
                    title={episodeTitles[epKey]}
                >
                    Ep {epKey}
                </button>
            ))}
        </nav>
    )
}
