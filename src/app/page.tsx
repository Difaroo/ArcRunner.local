'use client';

import { useState, useEffect, useRef } from 'react';
import { Clip, Series } from './api/clips/route';
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { ClipTable } from "@/components/clips/ClipTable"
import { EpisodeTabs } from "@/components/clips/EpisodeTabs"
import { ActionToolbar } from "@/components/clips/ActionToolbar"
import { LibraryActionToolbar } from "@/components/library/LibraryActionToolbar"
import { SeriesPage } from "@/components/series/SeriesPage"
import { SettingsPage } from "@/components/settings/SettingsPage"
import { DEFAULT_VIDEO_PROMPT, DEFAULT_IMAGE_PROMPT } from "@/lib/defaults"

import { PageHeader } from "@/components/PageHeader"

import { ScriptView } from "@/components/ingest/ScriptView"
import { LibraryTable } from "@/components/library/LibraryTable"


export interface LibraryItem {
  id: string;
  type: string;
  name: string;
  description: string;
  refImageUrl: string;
  negatives: string;
  notes: string;
  episode: string;
  series: string;
}

export default function Home() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [currentSeriesId, setCurrentSeriesId] = useState<string>("1");
  const [episodeTitles, setEpisodeTitles] = useState<Record<string, string>>({});
  const [allEpisodes, setAllEpisodes] = useState<{ series: string, id: string, title: string }[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Clip>>({});
  const [saving, setSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState('veo-fast');
  const [episodeStyles, setEpisodeStyles] = useState<Record<string, string>>({}); // Map Ep -> Style
  const [currentView, setCurrentView] = useState<'series' | 'script' | 'library' | 'clips' | 'settings'>('series');

  const [videoPromptTemplate, setVideoPromptTemplate] = useState("");
  const [imagePromptTemplate, setImagePromptTemplate] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");

  const handleViewChange = (view: 'series' | 'script' | 'library' | 'clips' | 'settings') => {
    if (currentView === 'settings' && view !== 'settings') {
      const savedVideo = localStorage.getItem("videoPromptTemplate")
      const savedImage = localStorage.getItem("imagePromptTemplate")
      setVideoPromptTemplate(savedVideo || DEFAULT_VIDEO_PROMPT)
      setImagePromptTemplate(savedImage || DEFAULT_IMAGE_PROMPT)
    }
    setCurrentView(view)
  }
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedVideo = localStorage.getItem("videoPromptTemplate")
    const savedImage = localStorage.getItem("imagePromptTemplate")
    setVideoPromptTemplate(savedVideo || DEFAULT_VIDEO_PROMPT)
    setImagePromptTemplate(savedImage || DEFAULT_IMAGE_PROMPT)
  }, [])

  const hasFetched = useRef(false);

  const refreshData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clips');
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setClips(data.clips);
      if (data.episodeTitles) setEpisodeTitles(data.episodeTitles);
      if (data.episodes) setAllEpisodes(data.episodes);
      if (data.libraryItems) setLibraryItems(data.libraryItems);
      if (data.series) {
        setSeriesList(data.series);
        // Default to first series if current is invalid
        if (!data.series.find((s: Series) => s.id === currentSeriesId)) {
          setCurrentSeriesId(data.series[0]?.id || "1");
        }
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    refreshData();
  }, []);

  // --- Editing Logic ---
  const startEditing = (clip: Clip) => {
    if (editingId === clip.id) return; // Already editing this one
    setEditingId(clip.id);
    setEditValues({ ...clip });
  };

  const handleSave = async (clipId: string, updates: Partial<Clip>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/update_clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: clipId, // id is the index
          updates: updates
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      // Update local state
      setClips(prev => prev.map(c => c.id === clipId ? { ...c, ...updates } : c));
      setEditingId(null);
      setEditValues({});

    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleLibrarySave = async (index: string, updates: Partial<any>) => {
    try {
      const res = await fetch('/api/update_library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: index,
          updates: updates
        }),
      });

      if (!res.ok) throw new Error('Failed to save library item');

      // Update local state
      setLibraryItems(prev => prev.map((item) =>
        item.id === index ? { ...item, ...updates } : item
      ));

    } catch (err) {
      console.error('Library Save error:', err);
      alert('Failed to save library item');
      throw err; // Propagate to component
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };


  // --- Episode Logic ---
  // Group clips by their explicit 'episode' field.
  const episodes: Clip[][] = [];
  const episodeMap = new Map<string, Clip[]>();

  // Filter Clips by Series
  const seriesClips = clips.filter(c => c.series === currentSeriesId);
  const seriesLibrary = libraryItems.filter(i => i.series === currentSeriesId);

  seriesClips.forEach(clip => {
    const ep = clip.episode || '1';
    if (!episodeMap.has(ep)) {
      episodeMap.set(ep, []);
    }
    episodeMap.get(ep)?.push(clip);
  });

  // Combine keys from both clips and the EPISODES sheet (Filtered by Series)
  // We use `allEpisodes` from API which has Series ID.
  const seriesEpisodeList = allEpisodes.filter(e => e.series === currentSeriesId);

  // Also include episodes found in clips for this series (in case they aren't in the sheet yet)
  const clipEpKeys = Array.from(episodeMap.keys());

  const allEpKeys = new Set([...clipEpKeys, ...seriesEpisodeList.map(e => e.id)]);

  // Convert to array, sorted by episode number (numeric)
  const sortedEpKeys = Array.from(allEpKeys).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  sortedEpKeys.forEach(key => {
    episodes.push(episodeMap.get(key) || []);
  });

  // Create Series-Specific Title Map
  const seriesEpisodeTitles: Record<string, string> = {};
  seriesEpisodeList.forEach(e => {
    seriesEpisodeTitles[e.id] = e.title;
  });

  // Note: activeClips might be empty if the episode exists in titles but has no clips yet
  // We need to be careful with indexing 'episodes' array if we rely on sortedEpKeys order
  // The 'episodes' array is pushed in the same order as sortedEpKeys, so index matches.
  const activeClips = episodes[currentEpisode - 1] || [];
  const currentEpKey = sortedEpKeys[currentEpisode - 1] || '1';
  const currentEpTitle = seriesEpisodeTitles[currentEpKey] ? `: ${seriesEpisodeTitles[currentEpKey]}` : '';

  // Unique Values for Dropdowns (Filtered by Series)
  const uniqueValues = {
    characters: Array.from(new Set(seriesLibrary.filter(i => i.type === 'LIB_CHARACTER').map(i => i.name))).sort(),
    locations: Array.from(new Set(seriesLibrary.filter(i => i.type === 'LIB_LOCATION').map(i => i.name))).sort(),
    styles: Array.from(new Set(seriesLibrary.filter(i => i.type === 'LIB_STYLE').map(i => i.name))).sort(),
    cameras: Array.from(new Set(seriesLibrary.filter(i => i.type === 'LIB_CAMERA').map(i => i.name))).sort(),
  };

  // --- Auto-Set Model from Episode Clips ---
  useEffect(() => {
    if (activeClips.length > 0) {
      // Check if any clip has a defined model? Or just the first one?
      // Let's check the first one as a heuristic for the Episode's default.
      const firstModel = activeClips[0].model;
      if (firstModel && firstModel !== selectedModel) {
        // Only update if it's a valid known model to avoid garbage
        if (['veo-fast', 'veo-quality', 'flux-pro', 'flux-flex'].includes(firstModel)) {
          setSelectedModel(firstModel);
        }
      }
    }
  }, [currentEpisode, currentSeriesId, activeClips]); // Dependency on "Episode Switch" (indicated by ID change)

  // --- Selection Logic (Clips) ---
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === activeClips.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeClips.map(c => c.id)));
    }
  };

  // --- Selection Logic (Library) ---
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());
  const [generatingLibraryItems, setGeneratingLibraryItems] = useState<Set<string>>(new Set());

  // Need filtered items for "Select All". Filter happens in render.
  // Replicate filtering logic here or hoist it.
  // Currently filtered in render: seriesLibrary.filter(item => item.episode === currentEpKey)
  const currentLibraryItems = seriesLibrary.filter(item => item.episode === currentEpKey);

  const toggleLibrarySelect = (id: string) => {
    const newSet = new Set(selectedLibraryIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedLibraryIds(newSet);
  };

  const toggleLibrarySelectAll = () => {
    if (selectedLibraryIds.size === currentLibraryItems.length) {
      setSelectedLibraryIds(new Set());
    } else {
      setSelectedLibraryIds(new Set(currentLibraryItems.map(i => i.id)));
    }
  };


  // --- Actions ---
  const handleGenerateSelected = async () => {
    const toGen = activeClips.filter(c => selectedIds.has(c.id));
    alert(`Generating ${toGen.length} clips... (Check console for progress)`);

    for (const clip of toGen) {
      // Find original index in full list for API
      const index = clips.findIndex(c => c.id === clip.id);
      await handleGenerate(clip, index);
    }
  };

  const handleDownloadSelected = () => {
    const toDownload = activeClips.filter(c => selectedIds.has(c.id) && c.resultUrl);
    if (toDownload.length === 0) return alert("No completed clips selected.");

    // Simple approach: Open each in new tab (browser might block popups)
    // Better: Generate a text file list? Or just loop open.
    toDownload.forEach(c => window.open(c.resultUrl, '_blank'));
  };

  const generateLibraryItem = async (item: LibraryItem) => {
    const rowIndex = parseInt(item.id);
    // Optimistic set generating
    setGeneratingLibraryItems(prev => new Set(prev).add(item.id));

    try {
      const res = await fetch('/api/generate-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, rowIndex })
      });
      const data = await res.json();
      console.log('Library Generate Result:', data);

      if (data.resultUrl) {
        // Update local state immediately logic?
        // Reload page or re-fetch library
        // For now, let's just complete the state. The user might need a refresh.
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingLibraryItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  const handleLibraryGenerateSelected = async () => {
    const toGen = currentLibraryItems.filter(item => selectedLibraryIds.has(item.id));
    alert(`Generating ${toGen.length} library items...`);

    for (const item of toGen) {
      await generateLibraryItem(item);
    }
  };

  const handleLibraryGenerate = async (item: LibraryItem) => {
    await generateLibraryItem(item);
  };

  const handleLibraryDownloadSelected = () => {
    const toDownload = currentLibraryItems.filter(item => selectedLibraryIds.has(item.id) && item.refImageUrl);
    if (toDownload.length === 0) return alert("No completed items selected.");
    toDownload.forEach(item => window.open(item.refImageUrl, '_blank'));
  };

  // --- Polling Logic ---
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      const generatingClips = clips.filter(c => c.status === 'Generating');
      if (generatingClips.length === 0) return;

      try {
        const res = await fetch('/api/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clips: generatingClips }),
        });

        const data = await res.json();
        if (data.success && data.checked > 0) {
          // Refresh clips to get new status/URLs
          // In a real app we might just update local state, but fetching full list ensures sync
          fetch('/api/clips')
            .then(res => res.json())
            .then(data => {
              if (data.clips) setClips(data.clips);
            });
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(pollInterval);
  }, [clips]);

  const handleGenerate = async (clip: Clip, index: number) => {
    try {
      // Optimistic update
      const newClips = [...clips];
      newClips[index].status = 'Generating';
      setClips(newClips);

      // Use Episode Style if available, otherwise fallback to clip style (which might be empty now)
      // Actually, user said "Make clip render function reference episode STYLE for all clips of the Ep"
      // So we override the clip's style with the Episode Style.
      const styleToUse = episodeStyles[currentEpKey] || clip.style;

      const endpoint = selectedModel.startsWith('flux') ? '/api/generate-image' : '/api/generate';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip: { ...clip, style: styleToUse }, // Override style
          library: seriesLibrary, // Use filtered library
          model: selectedModel,
          aspectRatio: aspectRatio, // Pass Aspect Ratio
          rowIndex: index // Pass row index for Flux route update
        }),
      });

      const data = await res.json();
      console.log('Backend Response:', data);

      if (!res.ok) throw new Error(data.error);
      console.log('Task started:', data.taskId);

      // Update local state with Task ID in resultUrl (so poller can find it)
      // We need to re-fetch or manually update the clip object
      newClips[index].resultUrl = data.taskId;
      setClips(newClips);

    } catch (error: any) {
      console.error('Generate failed:', error);
      // Revert status on error
      const newClips = [...clips];
      newClips[index].status = 'Error';
      setClips(newClips);
    }
  };

  const [playlist, setPlaylist] = useState<string[]>([]);
  const [currentPlayIndex, setCurrentPlayIndex] = useState<number>(-1);

  const handlePlayAll = () => {
    const validClips = activeClips.filter(c => c.status === 'Done' && c.resultUrl && c.resultUrl.startsWith('http'));
    if (validClips.length === 0) return;

    const urls = validClips.map(c => c.resultUrl as string);
    setPlaylist(urls);
    setCurrentPlayIndex(0);
    setPlayingVideoUrl(urls[0]);
  };

  const handleVideoEnded = () => {
    if (currentPlayIndex >= 0 && currentPlayIndex < playlist.length - 1) {
      const nextIndex = currentPlayIndex + 1;
      setCurrentPlayIndex(nextIndex);
      setPlayingVideoUrl(playlist[nextIndex]);
    } else {
      // End of playlist
      setPlaylist([]);
      setCurrentPlayIndex(-1);
      setPlayingVideoUrl(null);
    }
  };

  const handleIngest = async (json: string, defaultModel: string) => {
    const res = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json, episodeId: currentEpKey, seriesId: currentSeriesId, defaultModel }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ingest failed');

    alert(`Successfully ingested ${data.clipsCount} clips and ${data.libraryCount} library items!`);

    // Refresh and navigate
    await refreshData();
    handleViewChange('library');
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background font-display text-foreground">
      {/* Custom Video Player Modal */}
      {playingVideoUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => { setPlayingVideoUrl(null); setPlaylist([]); }}>
          <div className="relative w-[90vw] max-w-5xl aspect-video bg-black border border-zinc-800 shadow-2xl rounded-lg overflow-hidden group/player" onClick={e => e.stopPropagation()}>
            {/* Top Right Controls */}
            <div className="absolute top-4 right-4 z-50 flex gap-2">
              <button
                onClick={() => { setPlayingVideoUrl(null); setPlaylist([]); }}
                className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Bottom Controls Overlay (Visible on Hover) */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 z-40 flex justify-between items-end pointer-events-none">
              <div className="pointer-events-auto">
                {/* Playlist Counter */}
                {playlist.length > 0 && (
                  <div className="bg-black/50 text-white text-xs px-2 py-1 rounded inline-block mb-2">
                    Playing {currentPlayIndex + 1} of {playlist.length}
                  </div>
                )}
              </div>

              <div className="pointer-events-auto">
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Find the clip that owns this URL
                    // We can search 'clips' state for resultUrl === playingVideoUrl
                    // OR activeClips if we assume it's from the current view. 
                    // Searching all 'clips' is safer.
                    const currentUrl = playingVideoUrl;
                    const clip = clips.find(c => c.resultUrl === currentUrl);

                    if (clip) {
                      // Append URL to Ref Image URLs
                      const currentRefs = clip.refImageUrls || '';
                      const newRefs = currentRefs ? `${currentRefs}, ${currentUrl}` : currentUrl;

                      // Optimistic Update
                      setClips(prev => prev.map(c => c.id === clip.id ? { ...c, refImageUrls: newRefs } : c));

                      // API Call
                      handleSave(clip.id, { refImageUrls: newRefs });

                      alert("Added as Source Image!");
                    } else {
                      alert("Could not find source clip for this video.");
                    }
                  }}
                >
                  <span className="material-symbols-outlined !text-sm mr-2">add_photo_alternate</span>
                  Add Source Image
                </Button>
              </div>
            </div>

            <video
              src={playingVideoUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
              onEnded={handleVideoEnded}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-md px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">ArcRunner</h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">v0.4.0</span>

          <div className="h-6 w-px bg-border/40 mx-2"></div>

          <nav className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentView === 'series' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('series')}
                    className={`text-xs ${currentView === 'series' ? 'bg-stone-800 text-white' : 'text-stone-500'}`}
                  >
                    Series
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Series list</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentView === 'script' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('script')}
                    className={`text-xs ${currentView === 'script' ? 'bg-stone-800 text-white' : 'text-stone-500'}`}
                  >
                    Script
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Script ingestion</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentView === 'library' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('library')}
                    className={`text-xs ${currentView === 'library' ? 'bg-stone-800 text-white' : 'text-stone-500'}`}
                  >
                    Studio
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Studio Assets</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentView === 'clips' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('clips')}
                    className={`text-xs ${currentView === 'clips' ? 'bg-stone-800 text-white' : 'text-stone-500'}`}
                  >
                    Episode
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Episode Clips</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentView === 'settings' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('settings')}
                    className={`text-xs ${currentView === 'settings' ? 'bg-stone-800 text-white' : 'text-stone-500'}`}
                  >
                    Settings
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Status</span>
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500 animate-pulse' : error ? 'bg-destructive' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'}`}></div>
            <span className="font-medium text-foreground">{loading ? 'Syncing...' : error ? 'Error' : 'Connected'}</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.location.reload()}
                  className="h-8 w-8 text-primary hover:text-primary/80"
                >
                  <span className="material-symbols-outlined !text-lg">refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh Data</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Navigation & Toolbar */}
      <div className="flex flex-col border-b border-border/40 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 h-[45px]">
          {currentView !== 'series' && currentView !== 'settings' && (
            <EpisodeTabs
              episodeKeys={sortedEpKeys}
              currentEpisode={currentEpisode}
              episodeTitles={seriesEpisodeTitles}
              onEpisodeChange={(ep) => { setCurrentEpisode(ep); setSelectedIds(new Set()); setSelectedLibraryIds(new Set()); }}
            />
          )}

          <div className="flex items-center gap-2 py-2 ml-auto">
            {copyMessage && (
              <span className="text-xs text-green-500 animate-in fade-in slide-in-from-right-2 duration-300">
                {copyMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Episode Title Header - Only for Clips and Library View (Script View has its own) */}
      {(currentView === 'clips' || currentView === 'library') && (
        <PageHeader
          title={
            <div className="flex items-center gap-2">
              <span className="text-stone-500 font-normal">{seriesList.find(s => s.id === currentSeriesId)?.title}</span>
              <span className="text-stone-700">/</span>
              <span>{seriesEpisodeTitles[currentEpKey] ? seriesEpisodeTitles[currentEpKey] : `Episode ${currentEpKey}`}</span>
            </div>
          }
          className="border-t border-white/5 border-b-0"
        >
          {currentView === 'clips' && (
            <ActionToolbar
              currentEpKey={currentEpKey}
              totalClips={activeClips.length}
              readyClips={activeClips.filter(c => c.status === 'Done').length}
              selectedCount={selectedIds.size}
              onGenerateSelected={handleGenerateSelected}
              onDownloadSelected={handleDownloadSelected}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              currentStyle={episodeStyles[currentEpKey] || ''}
              onStyleChange={(style) => setEpisodeStyles(prev => ({ ...prev, [currentEpKey]: style }))}
              availableStyles={uniqueValues.styles}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
            />
          )}
          {currentView === 'library' && (
            <div className="flex items-center">
              {/* Reusing Action Toolbar style via pure component would be best, but LibraryActionToolbar is specific */}
              <LibraryActionToolbar
                selectedCount={selectedLibraryIds.size}
                onGenerateSelected={handleLibraryGenerateSelected}
                onDownloadSelected={handleLibraryDownloadSelected}
              />
            </div>
          )}
        </PageHeader>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md flex items-center">
          <span className="material-symbols-outlined mr-2">error</span>
          {error}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-background p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <span className="material-symbols-outlined text-4xl mb-2 text-primary animate-spin [animation-direction:reverse]">sync</span>
            <span className="font-light">Loading ArcRunner...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-destructive">
            <span className="material-symbols-outlined text-4xl mb-2">error_outline</span>
            <span className="font-light">Error loading data</span>
          </div>
        ) : (
          <div className="rounded-lg border border-border/40 bg-card/50 shadow-sm backdrop-blur-sm h-full flex flex-col">
            {currentView === 'series' ? (
              <SeriesPage
                seriesList={seriesList}
                currentSeriesId={currentSeriesId}
                onSeriesChange={setCurrentSeriesId}
                onAddSeries={async (title) => {
                  try {
                    const res = await fetch('/api/series', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title })
                    });
                    const data = await res.json();

                    if (data.success) {
                      // Create new Series object
                      const newSeries: Series = {
                        id: data.id,
                        title: data.title,
                        totalEpisodes: '0',
                        currentEpisodes: '0',
                        status: 'Active'
                      };

                      // Optimistic Update
                      setSeriesList(prev => [...prev, newSeries]);
                      setCurrentSeriesId(data.id);

                      alert(`Series "${title}" added!`);
                    } else {
                      alert('Failed to add series: ' + data.error);
                    }
                  } catch (e: any) {
                    alert('Error adding series: ' + e.message);
                  }
                }}
                clips={seriesClips}
                episodes={seriesEpisodeList}
                libraryItems={libraryItems} // Pass all library items, filtering happens inside or we pass filtered
                videoPromptTemplate={videoPromptTemplate}
                imagePromptTemplate={imagePromptTemplate}
              />
            ) : currentView === 'settings' ? (
              <SettingsPage onBack={() => handleViewChange('series')} />
            ) : currentView === 'script' ? (
              <ScriptView
                episodeId={currentEpKey}
                seriesId={currentSeriesId}
                seriesTitle={seriesList.find(s => s.id === currentSeriesId)?.title || 'Unknown Series'}
                onIngest={handleIngest}
              />
            ) : currentView === 'library' ? (
              <LibraryTable
                items={currentLibraryItems}
                onSave={handleLibrarySave}
                selectedItems={selectedLibraryIds}
                onSelect={toggleLibrarySelect}
                onSelectAll={toggleLibrarySelectAll}
                onGenerate={handleLibraryGenerate}
                isGenerating={(id) => generatingLibraryItems.has(id)}
              />
            ) : (
              <ClipTable
                clips={activeClips}
                selectedIds={selectedIds}
                editingId={editingId}
                saving={saving}
                onSelectAll={toggleSelectAll}
                onSelect={toggleSelect}
                onEdit={startEditing}
                onSave={handleSave}
                onCancelEdit={handleCancelEdit}
                onGenerate={(clip) => handleGenerate(clip, clips.findIndex(c => c.id === clip.id))}
                onPlay={(url) => {
                  if (!url) {
                    console.log('Play clicked but no URL');
                    return;
                  }
                  console.log('Play clicked with URL:', url);

                  // Check if it's an image (simple check)
                  if (url.match(/\.(jpeg|jpg|png|webp)$/i) || selectedModel.startsWith('flux')) { // Flux URLs might just be signed URLs
                    window.open(url, '_blank');
                    return;
                  }

                  setPlayingVideoUrl(url);
                  setPlaylist([url]);
                  setCurrentPlayIndex(0);
                }}
                uniqueValues={uniqueValues}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
