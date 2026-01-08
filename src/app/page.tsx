'use client';


import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2, Sun, Moon, Pencil, Check, X } from "lucide-react";
import { Clip, Series, Episode } from '@/types'; // Added Episode type import to fix linter error if it wasn't there
import { resolveClipImages } from '@/lib/shared-resolvers';
import { downloadFile, getClipFilename } from '@/lib/download-utils';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// Removed inline Dialog imports as they are moved to components
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"

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
import { StoryboardView } from "@/components/storyboard/StoryboardView"

// Modular Components
import { VideoPlayerOverlay } from "@/components/player/VideoPlayerOverlay";
import { AddSeriesDialog } from "@/components/dialogs/series/AddSeriesDialog";
import { NewEpisodeDialog } from "@/components/dialogs/episodes/NewEpisodeDialog";
import { StudioConfirmDialog } from "@/components/dialogs/generation/StudioConfirmDialog";
import { ClipConfirmDialog } from "@/components/dialogs/generation/ClipConfirmDialog";


import { LibraryItem } from '@/lib/library';
import { useDataStore } from '@/hooks/useDataStore';
import { useSharedSelection } from '@/hooks/useSharedSelection';
import { useMediaArchiver } from "@/hooks/useMediaArchiver";
import { usePolling } from '@/hooks/usePolling';

export default function Home() {
  const {
    clips, setClips,
    seriesList, setSeriesList,
    currentSeriesId, setCurrentSeriesId,
    episodeTitles,
    allEpisodes, setAllEpisodes,
    libraryItems, setLibraryItems,
    deletedLibraryIds, markLibraryItemDeleted,
    deletedClipIds, markClipDeleted,
    loading, error,
    refreshData,
    currentEpisode, setCurrentEpisode,
    playingVideoUrl, setPlayingVideoUrl
  } = useDataStore(s => s);

  // Initial Data Fetch (The Bridge Activation)
  const hasFetched = useRef(false);
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      refreshData();
    }
  }, [refreshData]);



  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Clip>>({});
  const [saving, setSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState('veo-fast');

  // Persistence Guard (Nav only)
  const [isRestored, setIsRestored] = useState(false);

  // --- Derive Current Episode Data ---
  // Find the episode object for the current series and episode number
  const currentEpObj = useMemo(() => {
    return allEpisodes.find(e => e.series === currentSeriesId && e.id === currentEpisode.toString());
  }, [allEpisodes, currentSeriesId, currentEpisode]);

  // Derived State (with defaults if missing)
  const currentStyle = currentEpObj?.style || '';
  const currentGuidance = currentEpObj?.guidance ?? 5.0; // Default 5
  // const currentSeed = currentEpObj?.seed ?? null; // Prisma might return null
  // Careful: DB seed is number or null.
  const currentSeed = currentEpObj?.seed !== undefined ? currentEpObj.seed : null;
  const currentAspectRatio = currentEpObj?.aspectRatio || '16:9';

  // Optimize: Memoize filtered items
  const activeLibraryItems = useMemo(() =>
    libraryItems.filter(i => i.series === currentSeriesId),
    [libraryItems, currentSeriesId]
  );


  // --- Persistence Handler ---
  const updateEpisodeSetting = useCallback(async (updates: Partial<typeof currentEpObj>) => {
    if (!currentEpObj || !currentSeriesId) return;

    // 0. Snapshot for Revert
    const previousSnapshot = { ...currentEpObj };

    // 1. Optimistic Update
    setAllEpisodes(prev => prev.map(e =>
      (e.series === currentSeriesId && e.id === currentEpisode.toString()) ? { ...e, ...updates } : e
    ));

    // 2. API Call
    try {
      const res = await fetch('/api/update_episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId: currentSeriesId,
          episodeId: currentEpisode.toString(), // API expects '1'
          updates: updates
        })
      });

      if (!res.ok) {
        throw new Error(`Save failed: ${res.statusText}`);
      }
    } catch (e) {
      console.error("Failed to save episode settings", e);
      // 3. Revert Logic
      setAllEpisodes(prev => prev.map(e =>
        // Restore only the fields that were in the snapshot for this specific episode
        (e.series === currentSeriesId && e.id === currentEpisode.toString()) ? previousSnapshot : e
      ));
      alert("Failed to save settings. Reverting changes.");
    }
  }, [currentEpObj, currentSeriesId, currentEpisode, setAllEpisodes]);


  // Persist Navigation State Only
  useEffect(() => {
    const savedEpisode = localStorage.getItem('arcrunner_currentEpisode');
    if (savedEpisode) setCurrentEpisode(parseInt(savedEpisode));

    const savedSeries = localStorage.getItem('arcrunner_currentSeriesId');
    if (savedSeries && setCurrentSeriesId) setCurrentSeriesId(savedSeries);

    setIsRestored(true);
  }, []);

  useEffect(() => {
    if (!isRestored) return;
    localStorage.setItem('arcrunner_currentEpisode', currentEpisode.toString());
  }, [currentEpisode, isRestored]);

  useEffect(() => {
    if (!isRestored) return;
    if (currentSeriesId) localStorage.setItem('arcrunner_currentSeriesId', currentSeriesId);
  }, [currentSeriesId, isRestored]);

  // Episode & Series State
  const [currentView, setCurrentView] = useState<'series' | 'script' | 'library' | 'clips' | 'settings' | 'storyboard'>('series');
  const [printLayout, setPrintLayout] = useState<'3x2' | '6x1' | 'auto'>('3x2');

  // --- Series Renaming Logic ---
  const [isEditingSeriesName, setIsEditingSeriesName] = useState(false);
  const [tempSeriesName, setTempSeriesName] = useState("");

  const handleRenameSeries = async () => {
    if (!tempSeriesName.trim() || !currentSeriesId) return;

    // Find current object to check if changed
    const currentSeries = seriesList.find(s => s.id === currentSeriesId);
    if (currentSeries?.title === tempSeriesName) {
      setIsEditingSeriesName(false);
      return;
    }

    try {
      // Optimistic Update
      setSeriesList(prev => prev.map(s => s.id === currentSeriesId ? { ...s, title: tempSeriesName } : s));
      setIsEditingSeriesName(false);

      const res = await fetch('/api/update_series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId: currentSeriesId, title: tempSeriesName })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
    } catch (e: any) {
      alert("Failed to rename series: " + e.message);
      // Revert
      setSeriesList(prev => prev.map(s => s.id === currentSeriesId ? { ...s, title: currentSeries?.title || s.title } : s));
    }
  };

  const [videoPromptTemplate, setVideoPromptTemplate] = useState("");
  const [imagePromptTemplate, setImagePromptTemplate] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const { theme, setTheme } = useTheme();

  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  // --- Series Add Logic ---
  const [showAddSeriesDialog, setShowAddSeriesDialog] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [isAddingSeries, setIsAddingSeries] = useState(false);
  const [addSeriesError, setAddSeriesError] = useState<string | null>(null);

  // --- Episode Creation Logic ---
  const [showNewEpisodeDialog, setShowNewEpisodeDialog] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState("");
  const [newEpNumber, setNewEpNumber] = useState("");
  const [isCreatingEpisode, setIsCreatingEpisode] = useState(false);

  // handleCreateEpisode logic passed to dialog


  // Modular Dialog Handler
  const handleCreateNewEpisode = async (title: string, number: string) => {
    if (!currentSeriesId) return;

    // API Call
    const res = await fetch('/api/episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesId: currentSeriesId,
        title: title,
        number: number
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Optimistic Update
    const newEpisode: Episode = {
      series: currentSeriesId,
      id: data.episode.number.toString(),
      uuid: data.episode.id,
      title: data.episode.title,
      model: '',
      style: '',
      guidance: 5,
      aspectRatio: '16:9',
      seed: null
    };

    setAllEpisodes(prev => [...prev, newEpisode]);
    setShowNewEpisodeDialog(false);
  };

  // handleAddSeries logic simplified for dialog prop
  const handleAddNewSeries = async (title: string) => {
    const res = await fetch('/api/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title })
    });
    const data = await res.json();

    if (data.success) {
      const newSeries: Series = {
        id: data.id,
        title: data.title,
        totalEpisodes: '0',
        currentEpisodes: '0',
        status: 'Active',
        defaultModel: 'veo-fast'
      };
      // Optimistic Update
      setSeriesList(prev => [...prev, newSeries]);
      setCurrentSeriesId(data.id);
      setShowAddSeriesDialog(false);
    } else {
      throw new Error(data.error || 'Failed to add series');
    }
  };

  const handleSeriesUpdate = async (id: string, updates: Partial<Series>) => {
    // 1. Optimistic Update
    setSeriesList(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

    try {
      // 2. API Call
      const payload = { seriesId: id, ...updates };
      const res = await fetch('/api/update_series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Update failed");
    } catch (e) {
      console.error("Series update failed", e);
      refreshData(); // Revert/Refresh on error
    }
  };

  useEffect(() => {
    if (!showAddSeriesDialog) {
      setNewSeriesTitle("");
      setAddSeriesError(null);
      setIsAddingSeries(false);
    }
  }, [showAddSeriesDialog]);

  const handleViewChange = (view: 'series' | 'script' | 'library' | 'clips' | 'settings' | 'storyboard') => {
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

      const data = await res.json();
      if (!res.ok) throw new Error('Failed to save');

      // Update local state
      // Prefer server-returned clip which has authoritative image resolution
      if (data.success && data.clip) {
        setClips(prev => prev.map(c => c.id === clipId ? {
          ...c,
          ...data.clip,
          // CRITICAL FIX: Sync explicitRefUrls with the DB refImageUrls
          explicitRefUrls: data.clip.refImageUrls
        } : c));
      } else {
        // Fallback: Optimistic update with robust trimming
        setClips(prev => prev.map(c => {
          if (c.id !== clipId) return c;

          const merged = { ...c, ...updates };

          // Re-calculate Derived Ref Image URLs for display using SHARED RESOLVER
          // 1. Setup
          const findUrl = (name: string) => {
            // Resolver for Live Previews
            // Robust: Trim and Lowercase
            const cleanName = name.trim().toLowerCase();
            // Find item independent of source casing
            const item = allSeriesAssets.find(i => i.name.trim().toLowerCase() === cleanName);
            if (item?.refImageUrl) {
              // Fix: Handle multi-url strings (take first)
              return item.refImageUrl.split(',')[0].trim();
            }
            return undefined;
          };
          const { fullRefs, explicitRefs, characterImageUrls, locationImageUrls } = resolveClipImages(merged, findUrl);

          return {
            ...merged,
            refImageUrls: fullRefs,
            explicitRefUrls: explicitRefs,
            characterImageUrls,
            locationImageUrls
          };
        }));
      }

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
    // Auto-clear error status if image is updated (added or removed)
    const effectiveUpdates = { ...updates };
    if ('refImageUrl' in effectiveUpdates) {
      effectiveUpdates.status = '';
    }

    try {
      const res = await fetch('/api/update_library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: index,
          updates: effectiveUpdates
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


        setClips(prevClips => prevClips.map(clip => {
          // Helper to lookup in NEW library list
          const findUrl = (name: string) => {
            const item = newLibraryItems.find(i => i.name.toLowerCase() === name.toLowerCase() && i.series === currentSeriesId);
            return item?.refImageUrl;
          };

          const { fullRefs } = resolveClipImages(clip, findUrl);

          // Optimization: Only log if we found a match? No, relying on visual verification is enough.


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

  // Optimization: Memoize Library Items for this Series
  // This prevents recalculating the array on every render, though filter is cheap.
  // More importantly, it serves as a stable reference for dependent hooks.
  const allSeriesAssets = useMemo(() =>
    libraryItems.filter(i => i.series === currentSeriesId),
    [libraryItems, currentSeriesId]);

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
  const rawActiveClips = episodes[currentEpisode - 1] || [];

  // --- REACTIVITY FIX: Live Resolve Images ---
  // Re-calculate image URLs using the LATEST libraryItems.
  // This ensures that if a Library Asset is updated (e.g. image changed),
  // the Clip thumbnails update immediately without a refresh.
  const seriesLibraryMap = useMemo(() => {
    const map: Record<string, string> = {};
    allSeriesAssets.forEach(item => {
      // Create lookup map for resolver: key=name.toLowerCase(), value=refImageUrl
      // Handle the case where name might be missing
      if (item.name) map[item.name.toLowerCase()] = item.refImageUrl || '';
    });
    return map;
  }, [allSeriesAssets]);

  const findLibUrl = (name: string) => seriesLibraryMap[name.toLowerCase()];

  const activeClips = useMemo(() => {
    return rawActiveClips
      .filter(c => !deletedClipIds.has(c.id))
      .map(clip => {
        // Resolve images on the fly!
        const { characterImageUrls, locationImageUrls } = resolveClipImages(clip, findLibUrl, 'single');
        return {
          ...clip,
          characterImageUrls,
          locationImageUrls
        };
      });
  }, [rawActiveClips, deletedClipIds, seriesLibraryMap]);

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
    if (loading) return;
    // Find current episode object
    const currentEpObj = allEpisodes.find(e => e.series === currentSeriesId && e.id === currentEpKey);
    const currentSeries = seriesList.find(s => s.id === currentSeriesId);

    // Hierarchy: Episode Override > Series Default > Global Default
    const targetModel = currentEpObj?.model || currentSeries?.defaultModel || 'veo-fast';

    // console.log('[ModelSelect] Calc:', {
    //   epModel: currentEpObj?.model,
    //   seriesDefault: currentSeries?.defaultModel,
    //   target: targetModel,
    //   currentSelected: selectedModel
    // });

    // Only update if different to avoid loops (though strict equality check handles it)
    if (targetModel !== selectedModel) {
      // console.log('[ModelSelect] UPDATING to', targetModel);
      setSelectedModel(targetModel);
    }
  }, [currentEpisode, currentSeriesId, activeClips, allEpisodes, currentEpKey, seriesList, loading]); // Added seriesList dependency

  // --- Selection Logic via Hooks ---
  const {
    selectedIds,
    setSelectedIds,
    toggleSelect,
    toggleSelectAll
  } = useSharedSelection(activeClips);

  // --- Library Selection Logic ---
  // Determine displayed library items
  const currentLibraryItems = allSeriesAssets.filter(item => item.episode === currentEpKey && !deletedLibraryIds.has(item.id));

  const {
    selectedIds: selectedLibraryIds,
    setSelectedIds: setSelectedLibraryIds,
    toggleSelect: toggleLibrarySelect,
    toggleSelectAll: toggleLibrarySelectAll
  } = useSharedSelection(currentLibraryItems);

  // --- Robustness: Reset State on Series Change ---
  useEffect(() => {
    setCurrentEpisode(1);
    setSelectedIds(new Set());
    setSelectedLibraryIds(new Set());
  }, [currentSeriesId, setSelectedIds, setSelectedLibraryIds]);

  const [generatingLibraryItems, setGeneratingLibraryItems] = useState<Set<string>>(new Set());


  // --- Actions ---
  const handleGenerateSelected = async () => {
    // Check if any selected
    const toGen = activeClips.filter(c => selectedIds.has(c.id));
    if (toGen.length === 0) return;

    // Show Confirmation Dialog (Restored)
    setShowClipConfirm(true);
  };

  const executeClipGeneration = async () => {
    setShowClipConfirm(false); // Close Dialog
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

    // Use Episode Style if available
    // Note: 'currentEpKey' might not be available here as this function is used in loops.
    // However, Library items HAVE an 'episode' field. We should look up the style for THAT episode.
    const epKey = item.episode || '1';
    const styleToUse = allEpisodes.find(e => e.series === currentSeriesId && e.id === epKey)?.style || '';

    // DIRECT RESOLUTION: Solve Stale State Issue
    // Look up the series model directly from the source of truth
    const currentSeriesDirect = seriesList.find(s => s.id === currentSeriesId);
    const resolvedModel = currentSeriesDirect?.defaultModel || 'flux-2/flex-image-to-image';

    try {
      const res = await fetch('/api/generate-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item,
          rowIndex,
          style: styleToUse,
          styleStrength: currentGuidance, // Pass persistent guidance
          // refStrength removed
          seed: currentSeed ?? undefined,
          aspectRatio: currentAspectRatio, // Pass persistent aspect ratio
          model: resolvedModel // Use resolved model
        })
      });
      const data = await res.json();
      console.log('Library Generate Result:', data);

      // If we got a Task ID (or URL), update the item locally so polling picks it up
      // The API should have updated the sheet, but local state needs to match
      // If we got a Task ID (or STATUS), update the item locally so polling picks it up
      // The API should have updated the DB, but local state needs to match immediately
      if (data.status === 'GENERATING' || data.resultUrl) {
        setLibraryItems(prev => prev.map(i => {
          if (i.id === item.id) {
            return {
              ...i,
              status: data.status || i.status,
              taskId: data.taskId || i.taskId,
              refImageUrl: data.resultUrl || i.refImageUrl
            };
          }
          return i;
        }));
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

  // --- Studio Generation Confirmation ---
  const [showStudioConfirm, setShowStudioConfirm] = useState(false);
  // --- Clip Generation Confirmation (Restored) ---
  const [showClipConfirm, setShowClipConfirm] = useState(false);
  // showClipConfirm removed (handled by ActionToolbar)

  const handleOpenStudioConfirm = () => {
    if (selectedLibraryIds.size === 0) return;
    setShowStudioConfirm(true);
  };

  const executeStudioGeneration = async () => {
    setShowStudioConfirm(false); // Close first
    const toGen = currentLibraryItems.filter(item => selectedLibraryIds.has(item.id));
    setCopyMessage(`Generating ${toGen.length} library items...`);
    setTimeout(() => setCopyMessage(null), 3000);

    for (const item of toGen) {
      await generateLibraryItem(item);
    }
  };

  const handleLibraryGenerate = async (item: LibraryItem) => {
    await generateLibraryItem(item);
  };

  const handleLibraryDownloadSelected = async () => {
    const toDownload = currentLibraryItems.filter(item => selectedLibraryIds.has(item.id) && item.refImageUrl);
    if (toDownload.length === 0) return alert("No completed items selected.");

    // Sequential download to prevent browser blocking
    for (const item of toDownload) {
      if (!item.refImageUrl) continue;
      const ext = item.refImageUrl.split('.').pop()?.split('?')[0] || 'png';
      const filename = `${item.name}.${ext}`;
      await downloadFile(item.refImageUrl, filename);
      // Small delay to help browser manager
      await new Promise(r => setTimeout(r, 200));
    }
  };

  const handleDeleteLibraryItem = (id: string) => {
    markLibraryItemDeleted(id);
  };

  const handleDeleteClip = (id: string) => {
    markClipDeleted(id);
  };

  // --- Polling Logic ---
  // (Maintained by usePolling hook)
  usePolling({
    clips: clips,
    libraryItems: libraryItems,
    refreshData: refreshData,
    intervalMs: 10000 // 10s polling
  });


  // --- Duplicate Logic ---
  const handleDuplicateClip = async (id: string) => {
    // 1. Find the clip and its index
    const index = clips.findIndex(c => c.id === id);
    if (index === -1) return;

    const parentClip = clips[index];

    // 2. Scene Number Logic: STRICTLY NUMERIC
    const sceneNum = parseFloat(parentClip.scene);
    if (isNaN(sceneNum)) {
      alert("Cannot duplicate: Scene number must be numeric (e.g. '1.0').");
      return;
    }

    // New Scene = Parent + 0.1
    // Handle floating point precision issues (e.g. 1.2 + 0.1 = 1.29999)
    // toFixed(1) ensures 1.3
    const newScene = (sceneNum + 0.1).toFixed(1).replace(/\.0$/, ''); // Remove trailing .0 if integer results (1.9 + 0.1 = 2.0 -> 2)
    // Actually, user is using "1.2". So .1 increments? 
    // If scene is "1", duplicate -> "1.1" ?
    // If scene is "1.9", duplicate -> "2" ? Or "2.0"? 
    // Let's stick to standard math but keep format clean. 
    // If input was "1" (integer), 1+0.1=1.1.
    // If input was "1.2", 1.2+0.1=1.3.

    // 3. Sort Order Logic: Visual Insertion
    // We want it to appear AFTER the parent. 
    // Check if there is a next clip in the VISUAL list (activeClips). 
    // But 'activeClips' is the filter for current episode. The duplication should be in same episode.
    // Find parent in activeClips
    const visualIndex = activeClips.findIndex(c => c.id === id);
    const nextClip = activeClips[visualIndex + 1];

    let newSortOrder: number;
    const parentOrder = parentClip.sortOrder || 0;

    if (nextClip) {
      const nextOrder = nextClip.sortOrder || (parentOrder + 10); // Fallback
      // Midpoint
      newSortOrder = (parentOrder + nextOrder) / 2;
    } else {
      // End of list
      newSortOrder = parentOrder + 10;
    }

    // 4. Create New Clip Object
    // Temporary ID for optimistic UI (use a distinct prefix so we don't collide with stringified Ints)
    const tempId = `temp-${Date.now()}`;

    const newClip: Clip = {
      ...parentClip,
      id: tempId,
      scene: newScene,
      sortOrder: newSortOrder,
      status: 'Ready',
      resultUrl: '',
      taskId: '',
      // explicitRefUrls is copied. refImageUrls will be resolved by resolver locally.
      refImageUrls: '', // Reset derived
      explicitRefUrls: parentClip.explicitRefUrls // Keep explicit refs
    };

    // 5. Optimistic Update
    // Insert into clips array
    const updatedClips = [...clips];
    // Insert after parent in the main list? 
    // Actually simplicity: append or sort? 
    // The list is usually sorted by sortOrder. 
    // We should insert it into the array or let the sort take over?
    // The "ClipTable" uses "orderedClips" which sorts based on... "orderedClips" state initialized from props.
    // "db.clip.findMany" returns sorted by sortOrder.
    // So update 'clips' state. But insertion index matters if we map directly.
    // We should insert it at 'index + 1' in the master list to ensure it sits there until refresh.
    updatedClips.splice(index + 1, 0, newClip);

    setClips(updatedClips);

    try {
      // 6. API Call
      const res = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip: newClip })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Creation failed');

      // 7. Update Real ID
      setClips(prev => prev.map(c => {
        if (c.id === tempId) {
          return {
            ...c,
            id: data.clip.id,
            episode: data.clip.episode // Ensure consistent episode ID format
          };
        }
        return c;
      }));

      // Trigger resolver to ensure images show up
      // (Similar to handleSave)
      // With real ID available.

    } catch (e: any) {
      console.error("Duplicate failed", e);
      alert(`Failed to duplicate clip: ${e.message}`);
      // Revert
      setClips(prev => prev.filter(c => c.id !== tempId));
    }
  };

  const handleAddClip = async () => {
    if (!currentSeriesId) {
      alert("Please select a series first.");
      return;
    }

    // 1. Calculate Next Scene Number
    let nextScene = "1";
    let newSortOrder = 0;

    if (activeClips.length > 0) {
      const lastClip = activeClips[activeClips.length - 1];
      // Logic: SCN default is now 0 as per request.
      // Auto-increment logic removed/ignored for now.

      // Sort Order: Add 10 to the last one
      newSortOrder = (lastClip.sortOrder || 0) + 10;
    } else {
      // Empty list logic
      newSortOrder = 10;
    }

    // 2. Create Clip Object
    const tempId = `temp-${Date.now()}`;
    const newClip: Clip = {
      id: tempId,
      scene: "0",
      sortOrder: newSortOrder,
      status: 'Ready',
      resultUrl: '',
      taskId: '',
      refImageUrls: '',
      explicitRefUrls: '',
      episode: currentEpKey,
      series: currentSeriesId,
      // Optional Fields
      title: 'New Clip',
      character: '',
      location: '',
      action: '',
      camera: '',
      style: '',
      dialog: ''
    };

    // 3. Optimistic Update
    // 3. Optimistic Update
    setClips(prev => [newClip, ...prev]); // Prepend to top

    // 5. API Call
    try {
      const res = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip: newClip })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Creation failed');

      // Update Real ID
      setClips(prev => prev.map(c => {
        if (c.id === tempId) {
          return { ...c, id: data.clip.id, episode: data.clip.episode };
        }
        return c;
      }));
    } catch (e: any) {
      console.error("Add Clip Failed", e);
      alert("Failed to create clip: " + e.message);
      setClips(prev => prev.filter(c => c.id !== tempId));
    }
  };



  const handleDuplicateLibraryItem = async (id: string) => {
    // 1. Find Source
    const source = libraryItems.find(i => i.id === id);
    if (!source) return;

    // 2. Name Generation Logic (Recursive Check)
    const getUniqueName = (baseName: string): string => {
      let candidate = baseName + "_Copy";
      let counter = 1;

      // Check against ALL items in store (to be safe)
      // Helper to check existence
      const exists = (n: string) => libraryItems.some(i => i.name.toLowerCase() === n.toLowerCase() && i.series === currentSeriesId);

      // If simple _Copy exists, try _Copy_1, _Copy_2...
      if (!exists(candidate)) return candidate;

      const MAX_ATTEMPTS = 100;
      while (exists(`${candidate}_${counter}`) && counter < MAX_ATTEMPTS) {
        counter++;
      }
      return `${candidate}_${counter}`;
    };

    const newName = getUniqueName(source.name);

    // 3. Create Object
    const tempId = `temp-lib-${Date.now()}`;
    const newItem: LibraryItem = {
      ...source,
      id: tempId,
      name: newName,
      // Keep everything else same
    };

    // 4. Optimistic Update
    setLibraryItems(prev => [...prev, newItem]);

    // 5. API Persist
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Duplication failed');

      // Update Real ID
      setLibraryItems(prev => prev.map(i => {
        if (i.id === tempId) {
          return { ...i, id: data.item.id };
        }
        return i;
      }));

    } catch (e: any) {
      console.error("Library Duplicate Failed", e);
      alert("Failed to duplicate item: " + e.message);
      setLibraryItems(prev => prev.filter(i => i.id !== tempId));
    }
  };

  const handleAddLibraryItem = async () => {
    if (!currentSeriesId) {
      alert("No active series found. Cannot create item.");
      return;
    }

    // 1. Prepare New Item
    const tempId = `temp-lib-${Date.now()}`;
    const newItem: LibraryItem = {
      id: tempId,
      series: currentSeriesId,
      name: "New Item",
      type: "LIB_CHARACTER",
      description: "",
      refImageUrl: "",
      negatives: "",
      notes: "",
      episode: "1"
    };

    // 2. Optimistic Update
    setLibraryItems(prev => [newItem, ...prev]);

    // 3. API Persist
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Creation failed');

      // Update Real ID
      setLibraryItems(prev => prev.map(i => {
        if (i.id === tempId && data.item?.id) {
          return { ...i, id: data.item.id };
        }
        return i;
      }));

    } catch (e: any) {
      console.error("Add Library Item Failed", e);
      alert("Failed to create item: " + e.message);
      setLibraryItems(prev => prev.filter(i => i.id !== tempId));
    }
  };

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
      // Use Episode Style if available. LEGACY FALLBACK REMOVED.
      // We no longer fallback to clip.style to prevent confusion with old sheet data.
      const styleToUse = currentStyle || "";

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

  const handleIngest = async (json: string) => {
    // Resolve Default Model from Series
    const currentSeries = seriesList.find(s => s.id === currentSeriesId);
    const resolvedModel = currentSeries?.defaultModel || 'veo-3'; // Default to Veo 3 if not set

    const res = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json, episodeId: currentEpKey, seriesId: currentSeriesId, defaultModel: resolvedModel }),
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
      {/* Custom Video Player Modal */}
      <VideoPlayerOverlay
        url={playingVideoUrl}
        onClose={() => { setPlayingVideoUrl(null); setPlaylist([]); }}
        playlist={playlist}
        initialIndex={currentPlayIndex}
        clips={clips}
        archiveMedia={archiveMedia}
        isArchiving={isArchiving}
        libraryItems={libraryItems}
        onUpdateClip={handleSave}
        onUpdateLibrary={handleLibrarySave}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-md px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">ArcRunner</h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">v0.16.1 Phoenix</span>

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


            {/* Storyboard Button moved here */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={currentView === 'storyboard' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('storyboard')}
                    className={`text-xs ${currentView === 'storyboard' ? 'bg-stone-800 text-white' : 'text-stone-500'}`}
                  >
                    Storyboard
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Storyboard</p>
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
      </header >


      {/* Navigation & Toolbar */}
      < div className="flex flex-col border-b border-border/40 bg-background/50 backdrop-blur-sm print:hidden" >
        <div className="flex items-center justify-between px-6 h-[45px]">
          {/* Episode Tabs (Non-Series View) */}
          {currentView !== 'series' && currentView !== 'settings' && (
            <EpisodeTabs
              episodeKeys={sortedEpKeys}
              currentEpisode={currentEpisode}
              episodeTitles={seriesEpisodeTitles}
              onEpisodeChange={(ep) => { setCurrentEpisode(ep); setSelectedIds(new Set()); setSelectedLibraryIds(new Set()); }}
            />
          )}

          {/* Series Tabs (Series View) - MOVED HERE */}
          {currentView === 'series' && (
            <div className="flex items-center -mb-px overflow-x-auto">
              {seriesList.map(series => (
                <button
                  key={series.id}
                  onClick={() => setCurrentSeriesId(series.id)}
                  className={`nav-tab py-3 ${currentSeriesId === series.id ? 'active' : ''}`}
                >
                  {series.title}
                </button>
              ))}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowAddSeriesDialog(true)}
                      className="ml-2 h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10"
                    >
                      <span className="material-symbols-outlined !text-lg">add</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a new Series</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          <div className="flex items-center gap-2 py-2 ml-auto">
            {copyMessage && (
              <span className="text-xs text-green-500 animate-in fade-in slide-in-from-right-2 duration-300">
                {copyMessage}
              </span>
            )}
          </div>
        </div>
      </div >

      {/* ... (rest of code) ... */}

      {/* Add Series Dialog (Global) */}
      {/* Add Series Dialog (Global) */}
      <AddSeriesDialog
        open={showAddSeriesDialog}
        onOpenChange={setShowAddSeriesDialog}
        onAddSeries={handleAddNewSeries}
      />
      {
        (currentView === 'clips' || currentView === 'library' || currentView === 'script' || currentView === 'series' || currentView === 'settings' || currentView === 'storyboard') && (
          <PageHeader
            title={
              currentView === 'series' ? (
                isEditingSeriesName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={tempSeriesName}
                      onChange={(e) => setTempSeriesName(e.target.value)}
                      className="h-7 text-sm w-64 bg-stone-900 border-stone-700"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSeries();
                        if (e.key === 'Escape') setIsEditingSeriesName(false);
                      }}
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleRenameSeries}>
                      <Check className="w-4 h-4 text-green-500" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingSeriesName(false)}>
                      <X className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <span>{seriesList.find(s => s.id === currentSeriesId)?.title || 'Select Series'}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setTempSeriesName(seriesList.find(s => s.id === currentSeriesId)?.title || "");
                        setIsEditingSeriesName(true);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5 text-stone-500" />
                    </Button>
                  </div>
                )
              ) : currentView === 'settings' ? (
                <span>Settings</span>
              ) : (
                <div className="flex items-center justify-start gap-2 w-fit whitespace-nowrap">
                  <span className="font-normal text-muted-foreground">{seriesList.find(s => s.id === currentSeriesId)?.title}</span>
                  <>
                    <span className="text-stone-700">/</span>
                    <span className="text-foreground">{seriesEpisodeTitles[currentEpKey] ? seriesEpisodeTitles[currentEpKey] : `Episode ${currentEpKey}`}</span>
                  </>
                </div>
              )
            }
            className="border-t border-white/5 border-b-0 print:mb-8"
          >
            {currentView === 'series' && (
              <div className="flex items-center gap-4">
                <span className="text-xs text-stone-500 uppercase tracking-wider font-light">New Episode</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline-primary"
                        size="icon"
                        onClick={() => setShowNewEpisodeDialog(true)}
                        className="h-8 w-8 hover:!bg-primary/20"
                      >
                        <span className="material-symbols-outlined !text-lg">add</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>NEW EPISODE</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
            {currentView === 'settings' && (
              <div className="flex items-center gap-4">
                <span className="text-xs text-stone-500 uppercase tracking-wider font-light">Theme</span>
                <div className="flex items-center gap-2 p-1 bg-black/40 rounded-full border border-white/5">
                  <button
                    onClick={() => setTheme("light")}
                    className={`p-1.5 rounded-full transition-all ${theme === "light" ? "bg-stone-700 text-white shadow-sm" : "text-stone-500 hover:text-stone-300"}`}
                  >
                    <Sun className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`p-1.5 rounded-full transition-all ${theme === "dark" ? "bg-stone-700 text-white shadow-sm" : "text-stone-500 hover:text-stone-300"}`}
                  >
                    <Moon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            {currentView === 'clips' && (
              <ActionToolbar
                currentEpKey={currentEpKey}
                totalClips={activeClips.length}
                readyClips={activeClips.filter(c => c.status === 'Done').length}
                selectedCount={activeClips.filter(c => selectedIds.has(c.id)).length}
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
                currentStyle={currentStyle}
                onStyleChange={(style) => updateEpisodeSetting({ style })}
                availableStyles={uniqueValues.styles}
                aspectRatio={currentAspectRatio}
                onAspectRatioChange={(ratio) => updateEpisodeSetting({ aspectRatio: ratio })}
                onAddClip={handleAddClip}
                clips={activeClips}
              />
            )}
            {currentView === 'library' && (
              <div className="flex items-center">
                {/* Reusing Action Toolbar style via pure component would be best, but LibraryActionToolbar is specific */}
                <LibraryActionToolbar
                  totalItems={activeLibraryItems.length}
                  selectedCount={selectedLibraryIds.size}
                  onGenerateSelected={handleOpenStudioConfirm}
                  onDownloadSelected={handleLibraryDownloadSelected}
                  currentStyle={currentStyle}
                  onStyleChange={(style) => updateEpisodeSetting({ style })}
                  availableStyles={uniqueValues.styles}
                  onAddItem={handleAddLibraryItem}
                  styleStrength={currentGuidance}
                  onStyleStrengthChange={(val) => updateEpisodeSetting({ guidance: val })}
                  // refStrength removed
                  seed={currentSeed}
                  onSeedChange={(val) => updateEpisodeSetting({ seed: val })}
                  aspectRatio={currentAspectRatio}
                  onAspectRatioChange={(ratio) => updateEpisodeSetting({ aspectRatio: ratio })}
                />
              </div>
            )}
            {currentView === 'storyboard' && (
              <div className="flex items-center gap-4 print:hidden">
                <div className="flex gap-2 items-center text-sm text-stone-400 bg-stone-900 border border-stone-800 rounded-md p-1 mr-4">
                  <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold px-2">Layout</span>
                  <Button
                    onClick={() => setPrintLayout('3x2')}
                    size="sm"
                    variant={printLayout === '3x2' ? 'default' : 'outline'}
                    className={`h-7 text-xs gap-1 ${printLayout !== '3x2' ? 'border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary' : ''}`}
                  >
                    <span className="material-symbols-outlined !text-sm">crop_landscape</span>
                    Landscape
                  </Button>
                  <Button
                    onClick={() => setPrintLayout('6x1')}
                    size="sm"
                    variant={printLayout === '6x1' ? 'default' : 'outline'}
                    className={`h-7 text-xs gap-1 ${printLayout !== '6x1' ? 'border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary' : ''}`}
                  >
                    <span className="material-symbols-outlined !text-sm">crop_portrait</span>
                    Portrait
                  </Button>
                  <Button
                    onClick={() => setPrintLayout('auto')}
                    size="sm"
                    variant={printLayout === 'auto' ? 'default' : 'outline'}
                    className={`h-7 text-xs gap-1 ${printLayout !== 'auto' ? 'border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary' : ''}`}
                  >
                    <span className="material-symbols-outlined !text-sm">auto_awesome</span>
                    Auto
                  </Button>
                </div>

                <Button
                  variant="default"
                  size="icon"
                  onClick={() => window.print()}
                  className="h-8 w-8"
                  title="Export PDF"
                >
                  <span className="material-symbols-outlined !text-lg">print</span>
                </Button>
              </div>
            )}
            {/* Script View needs no toolbar actions in header currently, or maybe move the ingestion controls here later? For now, empty or standard. */}
          </PageHeader>
        )
      }

      {/* Error Banner */}
      {
        error && (
          <div className="mx-6 mt-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md flex items-center">
            <span className="material-symbols-outlined mr-2">error</span>
            {error}
          </div>
        )
      }

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
                onRefresh={refreshData}
                onUpdateSeries={handleSeriesUpdate}
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
                onDelete={handleDeleteLibraryItem}
                onDuplicate={handleDuplicateLibraryItem}
              />
            ) : currentView === 'storyboard' ? (
              <StoryboardView
                clips={activeClips}
                onToggleHide={(clipId, hidden) => handleSave(clipId, { isHiddenInStoryboard: hidden })}
                printLayout={printLayout}
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
                onDelete={handleDeleteClip}
                onDuplicate={handleDuplicateClip}
                seriesTitle={seriesList.find(s => s.id === currentSeriesId)?.title || 'Series'}
              />
            )}
          </div>
        )}
      </main>

      {/* Modular Dialogs */}
      <NewEpisodeDialog
        open={showNewEpisodeDialog}
        onOpenChange={setShowNewEpisodeDialog}
        onCreateEpisode={handleCreateNewEpisode}
      />

      <StudioConfirmDialog
        open={showStudioConfirm}
        onOpenChange={setShowStudioConfirm}
        count={selectedLibraryIds.size}
        onConfirm={executeStudioGeneration}
        model={selectedModel}
        style={currentStyle}
        aspectRatio={currentAspectRatio}
        guidance={currentGuidance}
        seed={currentSeed}
      />

      <ClipConfirmDialog
        open={showClipConfirm}
        onOpenChange={setShowClipConfirm}
        count={activeClips.filter(c => selectedIds.has(c.id)).length}
        onConfirm={executeClipGeneration}
        model={selectedModel}
        style={currentStyle}
        aspectRatio={currentAspectRatio}
      />




    </div >
  );
}

