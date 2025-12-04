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
                    className={`border-b-2 px-4 py-3 text-sm font-normal whitespace-nowrap transition-colors ${currentEpisode === i + 1
                        ? 'border-primary text-primary'
                        : 'border-transparent text-stone-500 hover:text-white hover:border-stone-700'
                        }`}
                    title={episodeTitles[epKey]}
                >
                    Ep {epKey}
                </button>
            ))}
        </nav>
    )
}
