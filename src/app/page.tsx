"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2, Sun, Moon // Icons
} from "lucide-react";

import { useStore } from "@/store/useStore";
import { usePolling } from "@/hooks/usePolling";
import { useActiveClips } from "@/hooks/useActiveClips";
import { useMediaArchiver } from "@/hooks/useMediaArchiver";

// Components
import { PageHeader } from "@/components/layout/PageHeader";
import { EpisodeTabs } from "@/components/navigation/EpisodeTabs";
import { SeriesView } from "@/components/series/SeriesView";
import { LibraryView } from "@/components/library/LibraryView";
import { EpisodeView } from "@/components/clips/EpisodeView";
import { StoryboardView } from "@/components/storyboard/StoryboardView";
import { ScriptView } from "@/components/ingest/ScriptView";
import { SettingsPage } from "@/components/settings/SettingsPage";

// UI
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// Utils
import { Series } from "@/types";

export default function Page() {
  const {
    clips, setClips, // Needed for MediaArchiver
    libraryItems, setLibraryItems, // Needed for MediaArchiver
    seriesList,
    currentSeriesId,
    currentEpisode, setCurrentEpisode, navigateToEpisode,
    refreshData,
    loading, error,

    // Player State
    playingVideoUrl, setPlayingVideoUrl,
    playlist, setPlaylist,
    currentPlayIndex, setCurrentPlayIndex
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
  // We use this hook to get resolved clips for Storyboard and logic sharing
  const { activeClips, sortedEpKeys } = useActiveClips();


  // --- View State ---
  // We keep 'currentView' local to Page because it's the top-level router effectively.
  // Unless we want to move routing to Store too?
  // page.tsx managed 'currentView'. Store has 'currentSeriesId' and 'currentEpisode'.
  // 'currentView' defaults to 'series' (or clips if episodes exist?).
  // Let's keep it local state for now.
  const [currentView, setCurrentView] = useState('series');

  // --- Archive Hook (For Player Save Ref) ---
  const { archiveMedia, isArchiving } = useMediaArchiver({
    clips, setClips,
    libraryItems, setLibraryItems,
    onClipSave: async (id, updates) => {
      try {
        await fetch('/api/update_clip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowIndex: id, updates }),
        });
        // Optimistic update
        setClips(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      } catch (e) { console.error(e); }
    },
    onLibrarySave: async (id, updates) => {
      try {
        await fetch('/api/update_library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowIndex: id, updates }),
        });
        setLibraryItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
      } catch (e) { console.error(e); }
    },
    setPlayingVideoUrl
  });


  // --- New Episode Dialog State ---
  const [showNewEpisodeDialog, setShowNewEpisodeDialog] = useState(false);
  const [newEpNumber, setNewEpNumber] = useState("");
  const [newEpTitle, setNewEpTitle] = useState("");
  const [isCreatingEpisode, setIsCreatingEpisode] = useState(false);

  const handleCreateEpisode = async () => {
    if (!newEpNumber || !newEpTitle) return;
    setIsCreatingEpisode(true);
    try {
      const res = await fetch('/api/create_episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId: currentSeriesId,
          number: parseInt(newEpNumber),
          title: newEpTitle
        })
      });

      if (!res.ok) throw new Error("Failed to create episode");

      await refreshData(); // Refresh to see new episode
      setShowNewEpisodeDialog(false);
      setNewEpNumber("");
      setNewEpTitle("");
    } catch (e) {
      console.error(e);
      alert("Failed to create episode");
    } finally {
      setIsCreatingEpisode(false);
    }
  };

  // --- Ingest Handler (Script) ---
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

  // --- Storyboard State & Helpers ---
  const [printLayout, setPrintLayout] = useState<'3x2' | '6x1' | 'auto'>('auto');

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


  // --- Render ---

  // Player Navigation
  const handlePrevVideo = () => {
    if (currentPlayIndex > 0) {
      setCurrentPlayIndex(currentPlayIndex - 1);
      setPlayingVideoUrl(playlist[currentPlayIndex - 1]);
    }
  };
  const handleNextVideo = () => {
    if (currentPlayIndex < playlist.length - 1) {
      setCurrentPlayIndex(currentPlayIndex + 1);
      setPlayingVideoUrl(playlist[currentPlayIndex + 1]);
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

        {/* Note: Library Toolbar is now inside LibraryView. Clip Toolbar is inside EpisodeView. */}
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

      {/* Dialogs */}

      {/* New Episode Dialog */}
      <Dialog open={showNewEpisodeDialog} onOpenChange={setShowNewEpisodeDialog}>
        <DialogContent className="sm:max-w-[425px] bg-stone-900 border-stone-800 text-stone-100 p-6">
          <DialogHeader><DialogTitle>New Episode</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Episode Number</label>
              <Input value={newEpNumber} onChange={e => setNewEpNumber(e.target.value)} placeholder="e.g. 2" className="bg-stone-950 border-stone-800" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={newEpTitle} onChange={e => setNewEpTitle(e.target.value)} placeholder="The Awakening" className="bg-stone-950 border-stone-800" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewEpisodeDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateEpisode} disabled={isCreatingEpisode}>
              {isCreatingEpisode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Player Modal */}
      <Dialog open={!!playingVideoUrl} onOpenChange={(open) => !open && setPlayingVideoUrl(null)}>
        <DialogContent className="max-w-6xl w-full p-0 bg-black border-stone-800 overflow-hidden flex flex-col h-[85vh]">
          <div className="relative flex-1 bg-black flex items-center justify-center group">
            {playingVideoUrl && (
              <video
                src={playingVideoUrl}
                controls
                autoPlay
                className="max-h-full max-w-full outline-none"
                onEnded={handleNextVideo}
              />
            )}

            {/* Prev/Next Overlay Buttons */}
            {playlist.length > 1 && (
              <>
                {currentPlayIndex > 0 && (
                  <button onClick={handlePrevVideo} className="absolute left-4 top-1/2 -translate-y-1/2 p-4 text-white/20 hover:text-white hover:bg-black/50 rounded-full transition-all">
                    <span className="material-symbols-outlined !text-4xl">chevron_left</span>
                  </button>
                )}
                {currentPlayIndex < playlist.length - 1 && (
                  <button onClick={handleNextVideo} className="absolute right-4 top-1/2 -translate-y-1/2 p-4 text-white/20 hover:text-white hover:bg-black/50 rounded-full transition-all">
                    <span className="material-symbols-outlined !text-4xl">chevron_right</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Player Footer (Actions) */}
          <div className="p-4 bg-stone-900 border-t border-stone-800 flex justify-between items-center">
            <div className="text-sm text-stone-400 font-mono truncate max-w-md">
              {playingVideoUrl?.split('/').pop()}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => archiveMedia(playingVideoUrl!)}>
                {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined">save</span>}
                <span className="ml-2">Save as Reference</span>
              </Button>
              <Button variant="default" size="sm" onClick={() => setPlayingVideoUrl(null)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
