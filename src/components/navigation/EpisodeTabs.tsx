import { Button } from "@/components/ui/button"

interface EpisodeTabsProps {
    currentEpisode: number;
    episodeKeys: string[];
    onEpisodeChange: (episode: number) => void;
}

export function EpisodeTabs({ currentEpisode, episodeKeys, onEpisodeChange }: EpisodeTabsProps) {
    return (
        <div className="border-b border-border/40 bg-background/30 backdrop-blur-sm px-6 py-0 flex items-center gap-1 overflow-x-auto no-scrollbar h-[40px] shrink-0">
            <span className="text-[10px] uppercase font-bold text-stone-600 mr-2 tracking-widest">Episodes</span>
            {episodeKeys.map((key, index) => {
                const epNum = index + 1;
                const isActive = epNum === currentEpisode;
                /* 
                   Note: user might have ID "101" but it's the 1st episode.
                   We display the KEY (ID) usually, or just "Ep 1"?
                   ArcRunner tradition seems to be ID is the number.
                   But if ID is UUID, we should display index or lookup title?
                   For tabs, "1", "2", "3" (Sequence) is safest UI.
                   But if key is "5", user expects "5".
                   Let's display the KEY if it's numeric, else Index.
                */
                const label = isNaN(parseInt(key)) ? `${index + 1}` : key;

                return (
                    <button
                        key={key}
                        onClick={() => onEpisodeChange(epNum)}
                        className={`
                            h-[28px] min-w-[28px] px-2 rounded text-xs font-medium transition-all
                            ${isActive
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-stone-500 hover:text-stone-300 hover:bg-white/5'}
                        `}
                    >
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
