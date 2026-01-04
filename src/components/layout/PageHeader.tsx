import { Button } from "@/components/ui/button"
import { Series } from "@/types"
import { Loader2 } from "lucide-react"

interface PageHeaderProps {
    currentView: string;
    setCurrentView: (view: string) => void;
    refreshData: () => void;
    seriesList: Series[];
    currentSeriesId: string;
    onSeriesChange: (id: string) => void;
    children?: React.ReactNode;
}

export function PageHeader({
    currentView,
    setCurrentView,
    refreshData,
    seriesList,
    currentSeriesId,
    onSeriesChange,
    children
}: PageHeaderProps) {

    const views = [
        { id: 'series', label: 'Series', icon: 'movie' },
        { id: 'clips', label: 'Clips', icon: 'splitscreen' },
        { id: 'library', label: 'Studio', icon: 'palette' }, // "Studio" is Library view
        { id: 'storyboard', label: 'Storyboard', icon: 'view_kanban' },
        { id: 'script', label: 'Script', icon: 'description' },
        { id: 'settings', label: 'Settings', icon: 'settings' },
    ];

    return (
        <header className="h-[60px] border-b border-border/40 bg-background/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-50 sticky top-0">
            {/* Left: Logo & Context */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-gradient-to-br from-primary to-orange-600 rounded-md flex items-center justify-center shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-white text-xl">auto_awesome_motion</span>
                    </div>
                    <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-stone-400">
                        ArcRunner
                    </span>
                    <span className="ml-2 text-[10px] text-stone-600 font-mono mt-1">v0.15.0</span>
                </div>

                {/* Series Selector */}
                <div className="h-8 w-[1px] bg-white/10 mx-2" />

                <div className="relative group">
                    <select
                        value={currentSeriesId}
                        onChange={(e) => onSeriesChange(e.target.value)}
                        className="appearance-none bg-stone-900/50 border border-stone-800 hover:border-stone-700 text-stone-200 text-sm rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer min-w-[160px]"
                    >
                        {seriesList.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none text-sm">
                        expand_more
                    </span>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={refreshData}
                    className="text-stone-500 hover:text-stone-300 transition-colors"
                >
                    <span className="material-symbols-outlined">sync</span>
                </Button>
            </div>

            {/* Center: Navigation */}
            <nav className="flex items-center bg-stone-900/50 p-1 rounded-lg border border-white/5">
                {views.map(view => (
                    <button
                        key={view.id}
                        onClick={() => setCurrentView(view.id)}
                        className={`
                            px-4 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all
                            ${currentView === view.id
                                ? 'bg-stone-800 text-white shadow-sm'
                                : 'text-stone-500 hover:text-stone-300 hover:bg-white/5'}
                        `}
                    >
                        <span className="material-symbols-outlined !text-base">{view.icon}</span>
                        {view.label}
                    </button>
                ))}
            </nav>

            {/* Right: Actions (Children) */}
            <div className="flex items-center justify-end min-w-[200px]">
                {children}
            </div>
        </header>
    )
}
