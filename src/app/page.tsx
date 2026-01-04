"use client";

import { useState, useEffect, useRef } from "react";
import { Sun, Moon } from "lucide-react";

import { useStore } from "@/store/useStore";
import { usePolling } from "@/hooks/usePolling";
import { useActiveClips } from "@/hooks/useActiveClips";

// Components
import { PageHeader } from "@/components/layout/PageHeader";
import { EpisodeTabs } from "@/components/navigation/EpisodeTabs";
import { SeriesView } from "@/components/series/SeriesView";
import { LibraryView } from "@/components/library/LibraryView";
import { EpisodeView } from "@/components/clips/EpisodeView";
import { StoryboardView } from "@/components/storyboard/StoryboardView";
import { ScriptView } from "@/components/ingest/ScriptView";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { GlobalPlayer } from "@/components/layout/GlobalPlayer";
import { NewEpisodeDialog } from "@/components/series/NewEpisodeDialog";

// UI
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function Page() {
  const {
    clips, setClips,
    libraryItems,
    seriesList,
    currentSeriesId,
    currentEpisode, setCurrentEpisode, navigateToEpisode,
    refreshData,
    loading, error
  } = useStore();

  // --- Theme ---
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // --- Initial Data Fetch & Polling ---
  const hasFetched = useRef(false);
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    refreshData();
  }, [refreshData]);

  // Poll for updates (Clips & Library)
  usePolling({ clips, libraryItems, refreshData });

  // --- Active Data Hooks ---
  const { activeClips, sortedEpKeys } = useActiveClips();

  // --- View State ---
  const [currentView, setCurrentView] = useState('series');
  const [printLayout, setPrintLayout] = useState<'3x2' | '6x1' | 'auto'>('auto');
  const [showNewEpisodeDialog, setShowNewEpisodeDialog] = useState(false);

  // --- Handlers ---
  const updateClip = async (id: string, updates: Partial<any>) => {
    try {
      await fetch('/api/update_clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: id, updates }),
      });
      setClips(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    } catch (e) { console.error(e); }
  };

  const handleIngest = async (scriptText: string) => {
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId: currentSeriesId,
          text: scriptText
        })
      });
      if (!res.ok) throw new Error("Ingest failed");
      refreshData();
      setCurrentView('clips');
    } catch (e) {
      console.error(e);
      alert("Import failed");
    }
  };


  return (
    <div className={`flex flex-col h-screen overflow-hidden text-stone-200 font-sans selection:bg-primary/30 ${theme} bg-stone-950`}>

      {/* Header */}
      <PageHeader
        currentView={currentView}
        setCurrentView={setCurrentView}
        refreshData={refreshData}
        seriesList={seriesList}
        currentSeriesId={currentSeriesId}
        onSeriesChange={(id) => useStore.setState({ currentSeriesId: id })}
      >
        {/* Header Right Content (Contextual) */}
        {currentView === 'series' && (
          <div className="flex items-center gap-4">
            <span className="text-xs text-stone-500 uppercase tracking-wider font-light">New Episode</span>
            <Button variant="outline-primary" size="icon" onClick={() => setShowNewEpisodeDialog(true)} className="h-8 w-8 hover:!bg-primary/20">
              <span className="material-symbols-outlined !text-lg">add</span>
            </Button>
          </div>
        )}

        {currentView === 'settings' && (
          <div className="flex items-center gap-4">
            <span className="text-xs text-stone-500 uppercase tracking-wider font-light">Theme</span>
            <div className="flex items-center gap-2 p-1 bg-black/40 rounded-full border border-white/5">
              <button onClick={() => setTheme("light")} className={`p-1.5 rounded-full ${theme === "light" ? "bg-stone-700 text-white" : "text-stone-500"}`}><Sun className="h-4 w-4" /></button>
              <button onClick={() => setTheme("dark")} className={`p-1.5 rounded-full ${theme === "dark" ? "bg-stone-700 text-white" : "text-stone-500"}`}><Moon className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* Storyboard Toolbar controls (Print Layout) */}
        {currentView === 'storyboard' && (
          <div className="flex items-center gap-4 print:hidden">
            <div className="flex gap-2 items-center text-sm text-stone-400 bg-stone-900 border border-stone-800 rounded-md p-1 mr-4">
              <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold px-2">Layout</span>
              <Button onClick={() => setPrintLayout('3x2')} size="sm" variant={printLayout === '3x2' ? 'default' : 'outline'} className="h-7 text-xs gap-1"><span className="material-symbols-outlined !text-sm">crop_landscape</span> Landscape</Button>
              <Button onClick={() => setPrintLayout('6x1')} size="sm" variant={printLayout === '6x1' ? 'default' : 'outline'} className="h-7 text-xs gap-1"><span className="material-symbols-outlined !text-sm">crop_portrait</span> Portrait</Button>
              <Button onClick={() => setPrintLayout('auto')} size="sm" variant={printLayout === 'auto' ? 'default' : 'outline'} className="h-7 text-xs gap-1"><span className="material-symbols-outlined !text-sm">auto_awesome</span> Auto</Button>
            </div>
            <Button variant="default" size="icon" onClick={() => window.print()} className="h-8 w-8" title="Export PDF"><span className="material-symbols-outlined !text-lg">print</span></Button>
          </div>
        )}
      </PageHeader>

      {/* Episode Tabs (Navigation) */}
      {currentView !== 'series' && currentView !== 'settings' && sortedEpKeys.length > 0 && (
        <EpisodeTabs
          currentEpisode={currentEpisode}
          episodeKeys={sortedEpKeys}
          onEpisodeChange={setCurrentEpisode}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-background p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin mb-2 text-primary" />
            <span className="font-light">Loading ArcRunner...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-destructive">
            <span className="material-symbols-outlined text-4xl mb-2">error_outline</span>
            <span className="font-light">Error: {error}</span>
          </div>
        ) : (
          <div className="rounded-lg border border-border/40 bg-card/50 shadow-sm backdrop-blur-sm h-full flex flex-col overflow-hidden">
            {/* View Switcher */}
            {currentView === 'series' && (
              <SeriesView
                onNavigateToEpisode={(sid, eid) => {
                  navigateToEpisode(sid, eid);
                  setCurrentView('clips');
                }}
              />
            )}
            {currentView === 'clips' && <EpisodeView />}
            {currentView === 'library' && <LibraryView />}
            {currentView === 'storyboard' && (
              <StoryboardView
                clips={activeClips}
                onToggleHide={(id, hidden) => updateClip(id, { isHiddenInStoryboard: hidden })}
                printLayout={printLayout}
              />
            )}
            {currentView === 'script' && (
              <ScriptView
                seriesId={currentSeriesId}
                seriesTitle={seriesList.find(s => s.id === currentSeriesId)?.title || ''}
                episodeId={currentEpisode.toString()}
                onIngest={handleIngest}
              />
            )}
            {currentView === 'settings' && (
              <SettingsPage onBack={() => setCurrentView('series')} />
            )}
          </div>
        )}
      </main>

      {/* Global Components */}
      <NewEpisodeDialog
        open={showNewEpisodeDialog}
        onOpenChange={setShowNewEpisodeDialog}
      />

      <GlobalPlayer />

    </div>
  );
}
