'use client';

import { useState, useEffect, useRef } from 'react';
import { Clip } from './api/clips/route';
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ClipTable } from "@/components/clips/ClipTable"
import { EpisodeTabs } from "@/components/clips/EpisodeTabs"
import { ActionToolbar } from "@/components/clips/ActionToolbar"



export default function Home() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [episodeTitles, setEpisodeTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Clip>>({});
  const [saving, setSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState('veo-fast');

  useEffect(() => {
    fetch('/api/clips')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setClips(data.clips);
        if (data.episodeTitles) setEpisodeTitles(data.episodeTitles);

        // Auto-select clips with empty status (ready for re-render)
        const emptyStatusIds = data.clips
          .filter((c: Clip) => {
            const isEmpty = !c.status || c.status.trim() === '';
            return isEmpty;
          })
          .map((c: Clip) => c.id);

        if (emptyStatusIds.length > 0) {
          setSelectedIds(prev => {
            const next = new Set(prev);
            emptyStatusIds.forEach((id: string) => next.add(id));
            return next;
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // --- Editing Logic ---
  const startEditing = (clip: Clip) => {
    if (editingId === clip.id) return; // Already editing this one
    setEditingId(clip.id);
    setEditValues({ ...clip });
  };

  const handleEditChange = (field: keyof Clip, value: string) => {
    setEditValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (clipId: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/update_clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: clipId, // id is the index
          updates: editValues
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      // Update local state
      setClips(prev => prev.map(c => c.id === clipId ? { ...c, ...editValues } : c));
      setEditingId(null);
      setEditValues({});

    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
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

  clips.forEach(clip => {
    const ep = clip.episode || '1';
    if (!episodeMap.has(ep)) {
      episodeMap.set(ep, []);
    }
    episodeMap.get(ep)?.push(clip);
  });

  // Combine keys from both clips and the EPISODES sheet
  const allEpKeys = new Set([...Array.from(episodeMap.keys()), ...Object.keys(episodeTitles)]);

  // Convert to array, sorted by episode number (numeric)
  const sortedEpKeys = Array.from(allEpKeys).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  sortedEpKeys.forEach(key => {
    episodes.push(episodeMap.get(key) || []);
  });

  // Note: activeClips might be empty if the episode exists in titles but has no clips yet
  // We need to be careful with indexing 'episodes' array if we rely on sortedEpKeys order
  // The 'episodes' array is pushed in the same order as sortedEpKeys, so index matches.
  const activeClips = episodes[currentEpisode - 1] || [];
  const currentEpKey = sortedEpKeys[currentEpisode - 1] || '1';
  const currentEpTitle = episodeTitles[currentEpKey] ? `: ${episodeTitles[currentEpKey]}` : '';

  // --- Selection Logic ---
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

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip, rowIndex: index, model: selectedModel }),
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

  return (
    <div className="flex h-screen w-full flex-col bg-background font-display text-foreground">
      {/* Custom Video Player Modal */}
      {playingVideoUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => { setPlayingVideoUrl(null); setPlaylist([]); }}>
          <div className="relative w-[90vw] max-w-5xl aspect-video bg-black border border-zinc-800 shadow-2xl rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setPlayingVideoUrl(null); setPlaylist([]); }}
              className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <video
              src={playingVideoUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
              onEnded={handleVideoEnded}
            />
            {playlist.length > 0 && (
              <div className="absolute bottom-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">
                Playing {currentPlayIndex + 1} of {playlist.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-md px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">ArcRunner</h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">v0.3.0</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Status</span>
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500 animate-pulse' : error ? 'bg-destructive' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'}`}></div>
            <span className="font-medium text-foreground">{loading ? 'Syncing...' : error ? 'Error' : 'Connected'}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.location.reload()}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Refresh Data"
          >
            <span className="material-symbols-outlined !text-lg">refresh</span>
          </Button>
        </div>
      </header>

      {/* Navigation & Toolbar */}
      <div className="flex flex-col border-b border-border/40 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6">
          <EpisodeTabs
            episodeKeys={sortedEpKeys}
            currentEpisode={currentEpisode}
            episodeTitles={episodeTitles}
            onEpisodeChange={(ep) => { setCurrentEpisode(ep); setSelectedIds(new Set()); }}
          />
          <ActionToolbar
            currentEpKey={currentEpKey}
            totalClips={activeClips.length}
            readyClips={activeClips.filter(c => c.status === 'Done').length}
            selectedCount={selectedIds.size}
            onGenerateSelected={handleGenerateSelected}
            onDownloadSelected={handleDownloadSelected}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>
        {/* Episode Title Header */}
        <div className="flex items-center px-6 h-14 border-t border-white/5">
          <h2 className="text-lg font-sans font-normal text-white">
            {episodeTitles[currentEpKey] ? episodeTitles[currentEpKey] : `Episode ${currentEpKey}`}
          </h2>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md flex items-center">
          <span className="material-symbols-outlined mr-2">error</span>
          {error}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground animate-pulse">
            <span className="material-symbols-outlined text-4xl mb-2">sync</span>
            <span className="font-light">Loading clips...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-destructive">
            <span className="material-symbols-outlined text-4xl mb-2">error_outline</span>
            <span className="font-light">Error loading data</span>
          </div>
        ) : (
          <div className="rounded-lg border border-border/40 bg-card/50 shadow-sm backdrop-blur-sm">
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

              uniqueValues={{
                characters: Array.from(new Set(clips.flatMap(c => (c.character || '').split(',').map(s => s.trim()).filter(Boolean)))).sort(),
                locations: Array.from(new Set(clips.map(c => c.location).filter(Boolean))).sort(),
                styles: Array.from(new Set(clips.map(c => c.style).filter(Boolean))).sort(),
                cameras: Array.from(new Set(clips.map(c => c.camera).filter(Boolean))).sort(),
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

