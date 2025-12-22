'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from "lucide-react";
import { Clip, Series } from './api/clips/route';
import { resolveClipImages } from '@/lib/shared-resolvers';
import { downloadFile, getClipFilename } from '@/lib/download-utils';
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


import { LibraryItem } from '@/lib/library';
import { useAppStore } from '@/hooks/useAppStore';
import { useSharedSelection } from '@/hooks/useSharedSelection';
import { useMediaArchiver } from "@/hooks/useMediaArchiver";

export default function Home() {
  const {
    clips, setClips,
    seriesList, setSeriesList, // setSeriesList might be unused if handled by store? exposed anyway
    currentSeriesId, setCurrentSeriesId,
    episodeTitles,
    allEpisodes, setAllEpisodes,
    libraryItems, setLibraryItems,
    loading, error,
    refreshData
  } = useAppStore();

  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Clip>>({});
  const [saving, setSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState('veo-fast');
  const [episodeStyles, setEpisodeStyles] = useState<Record<string, string>>({});
  const [currentView, setCurrentView] = useState<'series' | 'script' | 'library' | 'clips' | 'settings'>('series');

  const [videoPromptTemplate, setVideoPromptTemplate] = useState("");
  const [imagePromptTemplate, setImagePromptTemplate] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");

  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const handleViewChange = (view: 'series' | 'script' | 'library' | 'clips' | 'settings') => {
    if (currentView === 'settings' && view !== 'settings') {
      const savedVideo = localStorage.getItem("videoPromptTemplate")
      const savedImage = localStorage.getItem("imagePromptTemplate")
      setVideoPromptTemplate(savedVideo || DEFAULT_VIDEO_PROMPT)
      setImagePromptTemplate(savedImage || DEFAULT_IMAGE_PROMPT)
    }
    setCurrentView(view)
  }

  useEffect(() => {
    const savedVideo = localStorage.getItem("videoPromptTemplate")
    const savedImage = localStorage.getItem("imagePromptTemplate")
    const savedModel = localStorage.getItem("selectedModel")
    setVideoPromptTemplate(savedVideo || DEFAULT_VIDEO_PROMPT)
    setImagePromptTemplate(savedImage || DEFAULT_IMAGE_PROMPT)
    if (savedModel) setSelectedModel(savedModel)
  }, [])

  const hasFetched = useRef(false);

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

      // Update local state with Optimistic Library Lookup
      // We want to show the new thumbnails instantly without waiting for a refresh.
      // But we MUST NOT save these derived URLs to the 'explicitRefUrls' or sends them to backend.
      setClips(prev => prev.map(c => {
        if (c.id !== clipId) return c;

        const merged = { ...c, ...updates };

        // Re-calculate Derived Ref Image URLs for display using SHARED RESOLVER
        // 1. Setup Lookup
        const seriesLib = libraryItems.filter(i => i.series === currentSeriesId);
        const findUrl = (name: string) => {
          const item = seriesLib.find(i => i.name.toLowerCase() === name.toLowerCase());
          return item?.refImageUrl;
        }

        // 2. Resolve
        const { fullRefs, explicitRefs } = resolveClipImages(merged, findUrl);

        return { ...merged, refImageUrls: fullRefs, explicitRefUrls: explicitRefs };
      }));

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
      const newLibraryItems = libraryItems.map((item) =>
        item.id === index ? { ...item, ...updates } : item
      );
      setLibraryItems(newLibraryItems);

      // Propagate changes to Clis (Re-resolve images)
      if (updates.refImageUrl || updates.name) {
        // DEBUG: START TRACE - Log immediately
        fetch('/api/log_beacon', {
          method: 'POST',
          body: JSON.stringify({ type: 'Reactivity START', updates })
        }).catch(e => console.error(e));

        setClips(prevClips => prevClips.map(clip => {
          // Helper to lookup in NEW library list
          const findUrl = (name: string) => {
            const item = newLibraryItems.find(i => i.name.toLowerCase() === name.toLowerCase() && i.series === currentSeriesId);
            return item?.refImageUrl;
          };

          const { fullRefs } = resolveClipImages(clip, findUrl);

          // DEBUG: Trace specific matches via Beacon
          // FIX: updates.name might be missing, use the Actual Item Name
          const updatedItem = newLibraryItems.find(i => i.id === index);
          const nameToCheck = updatedItem?.name.toLowerCase() || '';

          const charMatch = clip.character?.toLowerCase().includes(nameToCheck);
          const locMatch = clip.location?.toLowerCase().includes(nameToCheck);

          // Always log if we found a match, OR if nameToCheck is suspiciously empty
          if ((charMatch || locMatch) && nameToCheck.length > 0) {
            fetch('/api/log_beacon', {
              method: 'POST',
              body: JSON.stringify({
                type: 'Reactivity Check',
                clipId: clip.id,
                char: clip.character,
                loc: clip.location,
                matchName: nameToCheck,
                newRefs: fullRefs,
                foundUrl: findUrl(nameToCheck)
              })
            }).catch(e => console.error(e));
          }

          return { ...clip, refImageUrls: fullRefs };
        }));
      }



    } catch (err) {
      console.error('Library Save error:', err);
      alert('Failed to save library item');
      throw err; // Propagate to component
    }
  };

  const { archiveMedia, isArchiving } = useMediaArchiver({
    clips,
    setClips,
    libraryItems,
    setLibraryItems,
    onClipSave: handleSave,
    onLibrarySave: handleLibrarySave,
    setPlayingVideoUrl
  });

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
  // Get ALL library items for the series (not just current episode) for Dropdowns
  const allSeriesAssets = libraryItems.filter(i => i.series === currentSeriesId);

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
  const activeClips = episodes[currentEpisode - 1] || [];
  const currentEpKey = sortedEpKeys[currentEpisode - 1] || '1';
  const currentEpTitle = seriesEpisodeTitles[currentEpKey] ? `: ${seriesEpisodeTitles[currentEpKey]}` : '';

  // Unique Values for Dropdowns (Filtered by Series, includes ALL episodes)
  const uniqueValues = {
    characters: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_CHARACTER').map(i => i.name))).sort(),
    locations: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_LOCATION').map(i => i.name))).sort(),
    styles: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_STYLE').map(i => i.name))).sort(),
    cameras: Array.from(new Set(allSeriesAssets.filter(i => i.type === 'LIB_CAMERA').map(i => i.name))).sort(),
  };

  // --- Auto-Set Model from Episode Settings ---
  useEffect(() => {
    // Find current episode object
    const currentEpObj = allEpisodes.find(e => e.series === currentSeriesId && e.id === currentEpKey);

    if (currentEpObj?.model) {
      if (currentEpObj.model !== selectedModel) {
        setSelectedModel(currentEpObj.model);
      }
    }
  }, [currentEpisode, currentSeriesId, activeClips, allEpisodes, currentEpKey]); // Check deps

  // --- Selection Logic via Hooks ---
  const {
    selectedIds,
    setSelectedIds,
    toggleSelect,
    toggleSelectAll
  } = useSharedSelection(activeClips);

  // --- Library Selection Logic ---
  // Determine displayed library items
  const currentLibraryItems = allSeriesAssets.filter(item => item.episode === currentEpKey);

  const {
    selectedIds: selectedLibraryIds,
    setSelectedIds: setSelectedLibraryIds,
    toggleSelect: toggleLibrarySelect,
    toggleSelectAll: toggleLibrarySelectAll
  } = useSharedSelection(currentLibraryItems);

  const [generatingLibraryItems, setGeneratingLibraryItems] = useState<Set<string>>(new Set());


  // --- Actions ---
  const handleGenerateSelected = async () => {
    const toGen = activeClips.filter(c => selectedIds.has(c.id));
    // Non-blocking notification
    setCopyMessage(`Generating ${toGen.length} clips...`);
    setTimeout(() => setCopyMessage(null), 3000);

    for (const clip of toGen) {
      // Find original index in full list for API
      const index = clips.findIndex(c => c.id === clip.id);
      await handleGenerate(clip, index);
    }
  };

  const handleDownloadSelected = async () => {
    const toDownload = activeClips.filter(c => selectedIds.has(c.id) && c.resultUrl);
    if (toDownload.length === 0) return alert("No completed clips selected.");

    // Sequential download to avoid overwhelming browser
    for (const clip of toDownload) {
      if (clip.resultUrl) {
        const filename = getClipFilename(clip);
        await downloadFile(clip.resultUrl, filename);
        // Optional: short delay
        await new Promise(r => setTimeout(r, 500));
      }
    }
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

      // If we got a Task ID (or URL), update the item locally so polling picks it up
      // The API should have updated the sheet, but local state needs to match
      if (data.resultUrl) {
        setLibraryItems(prev => prev.map(i => i.id === item.id ? { ...i, refImageUrl: data.resultUrl } : i));

        // If it's a TASK, keep the spinner going by NOT removing it from 'generatingLibraryItems' immediately?
        // Actually, the main polling loop drives the spinner now based on 'TASK:' prefix in refImageUrl.
        // But LibraryTable checks 'generatingLibraryItems' prop OR refImageUrl.
        // If we remove it here, the spinner might flicker if refImageUrl isn't updated?
        // Wait, LibraryTable checks: item.refImageUrl.startsWith('TASK:') ? Spinner : ...
        // So updating libraryItems is key.
      }

    } catch (e) {
      console.error(e);
      alert("Generation failed: " + e);
    } finally {
      // We only remove from 'generating' set if it failed or if we want to rely solely on refImageUrl
      // Let's remove it to let the 'TASK:' detection take over
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
  // --- Polling Logic ---
  // --- Polling Logic ---
  // --- Polling Logic ---
  // (Maintained by usePolling hook)


  const handleGenerate = async (clip: Clip, index: number) => {
    try {
      // Optimistic update
      const newClips = [...clips];
      // CRITICAL: Clear Result/TaskId to prevents Poller from seeing old 'Done' task
      newClips[index] = { ...newClips[index], status: 'Generating', resultUrl: '', taskId: '' };
      setClips(newClips);

      // Use Episode Style if available, otherwise fallback to clip style (which might be empty now)
      // Actually, user said "Make clip render function reference episode STYLE for all clips of the Ep"
      // So we override the clip's style with the Episode Style.
      const styleToUse = episodeStyles[currentEpKey] || clip.style;

      // Default to Image (Flux) if not explicitly Video (Veo) to prevent accidental cost
      const isVideo = selectedModel.startsWith('veo');
      const endpoint = isVideo ? '/api/generate' : '/api/generate-image';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip: { ...clip, style: styleToUse }, // Override style
          library: allSeriesAssets, // Use filtered library
          model: selectedModel || 'flux', // Provide fallback string
          aspectRatio: aspectRatio, // Pass Aspect Ratio
          rowIndex: parseInt(clip.id) // Use immutable ID (Sheet Row Index)
        }),
      });

      const data = await res.json();
      console.log('Backend Response:', data);

      if (!res.ok) throw new Error(data.error);
      console.log('Task started:', data.taskId);

      // Update local state with Task ID in resultUrl (so poller can find it)
      // Use resultUrl (Flux) or taskId (Veo)
      // Clone item to ensure React update
      newClips[index] = {
        ...newClips[index],
        resultUrl: data.resultUrl || data.taskId
      };
      setClips(newClips);

    } catch (error: any) {
      console.error('Generate failed:', error);
      alert(`Generation failed for clip ${clip.id}: ${error.message}`);
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
            {/* Top Right Controls */}
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await archiveMedia(playingVideoUrl);
                        }}
                        disabled={isArchiving}
                      >
                        {isArchiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <span className="material-symbols-outlined !text-sm mr-2">save</span>}
                        {isArchiving ? "Saving..." : "Save Reference Image"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download to local storage and set as permanent reference</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {(() => {
              // Determine media type
              const playingClip = clips.find(c => c.resultUrl === playingVideoUrl) || { model: '' };
              const isImage = playingClip.model?.includes('flux') || playingVideoUrl?.match(/\.(jpeg|jpg|png|webp)$/i);

              return isImage ? (
                <img
                  src={playingVideoUrl!}
                  className="w-full h-full object-contain"
                  alt="Generated Content"
                />
              ) : (
                <video
                  src={playingVideoUrl!}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                  onEnded={handleVideoEnded}
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-md px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">ArcRunner</h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">v0.7.4</span>

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

      {/* Episode Title Header - Only for Clips, Library, and SCRIPT View */}
      {(currentView === 'clips' || currentView === 'library' || currentView === 'script') && (
        <PageHeader
          title={
            <div className="flex items-center gap-2">
              <span className="text-stone-500 font-normal">{seriesList.find(s => s.id === currentSeriesId)?.title}</span>
              {currentView !== 'script' && (
                <>
                  <span className="text-stone-700">/</span>
                  <span>{seriesEpisodeTitles[currentEpKey] ? seriesEpisodeTitles[currentEpKey] : `Episode ${currentEpKey}`}</span>
                </>
              )}
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
              onModelChange={async (model) => {
                setSelectedModel(model);
                localStorage.setItem("selectedModel", model);
                // Persist to Episode
                try {
                  await fetch('/api/update_episode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      seriesId: currentSeriesId,
                      episodeId: currentEpKey,
                      updates: { model }
                    })
                  });

                  // Update local state to prevent "flicker" on next refresh or switch
                  setAllEpisodes(prev => prev.map(e =>
                    (e.series === currentSeriesId && e.id === currentEpKey)
                      ? { ...e, model }
                      : e
                  ));

                } catch (e) {
                  console.error("Failed to save episode model", e);
                }
              }}
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
          {/* Script View needs no toolbar actions in header currently, or maybe move the ingestion controls here later? For now, empty or standard. */}
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

                      // Return strict true for success
                      return Promise.resolve();
                    } else {
                      throw new Error(data.error || 'Failed to add series');
                    }
                  } catch (e: any) {
                    console.error("Add Series Failed:", e);
                    throw e; // Propagate to Child
                  }
                }}
                onNavigateToEpisode={(sid, eid) => {
                  setCurrentSeriesId(sid);
                  setCurrentEpisode(parseInt(eid) || 1);
                  handleViewChange('clips');
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
                onPlay={(url) => {
                  setPlayingVideoUrl(url);
                  setPlaylist([url]);
                  setCurrentPlayIndex(0);
                }}
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
