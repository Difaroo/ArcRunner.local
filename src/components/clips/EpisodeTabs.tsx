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
                    className={`nav-tab py-3 ${currentEpisode === i + 1 ? 'active' : ''}`}
                    title={episodeTitles[epKey]}
                >
                    Ep {epKey}
                </button>
            ))}
        </nav>
    )
}
