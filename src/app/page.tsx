'use client';

import { useEffect, useState } from 'react';

interface Clip {
  id: string;
  scene: string;
  status: string;
  title: string;
  character: string;
  location: string;
  action: string;
  dialog: string;
  refImageUrls: string;
  resultUrl: string;
}

export default function Home() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/clips')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setClips(data.clips);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // --- Episode Logic ---
  // Detect episodes by looking for Scene "1" resets or large gaps?
  // For now, let's assume a simple heuristic: If scene number < previous scene number, it's a new episode.
  const episodes: Clip[][] = [];
  let currentEp: Clip[] = [];
  let lastSceneNum = -1;

  clips.forEach(clip => {
    const sceneNum = parseInt(clip.scene) || 999;
    if (sceneNum < lastSceneNum && currentEp.length > 0) {
      episodes.push(currentEp);
      currentEp = [];
    }
    currentEp.push(clip);
    lastSceneNum = sceneNum;
  });
  if (currentEp.length > 0) episodes.push(currentEp);

  const activeClips = episodes[currentEpisode - 1] || [];

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
        body: JSON.stringify({ clip, rowIndex: index }),
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
    const validClips = clips.filter(c => c.status === 'Done' && c.resultUrl && c.resultUrl.startsWith('http'));
    if (validClips.length === 0) return;

    const urls = validClips.map(c => c.resultUrl);
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
    <div className="min-h-screen bg-[#1a1a1a] text-white font-sans" style={{ padding: '10px 40px 40px 40px' }}>
      {/* Video Player Modal */}
      {playingVideoUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => { setPlayingVideoUrl(null); setPlaylist([]); }}>
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-lg shadow-2xl overflow-hidden border border-gray-800" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setPlayingVideoUrl(null); setPlaylist([]); }}
              className="absolute top-4 right-4 z-10 text-white/50 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <video
              src={playingVideoUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
              onEnded={handleVideoEnded}
            />
            {playlist.length > 0 && (
              <div className="absolute bottom-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded">
                Playing {currentPlayIndex + 1} of {playlist.length}
              </div>
            )}
          </div>
        </div>
      )}

      <header className="flex justify-between items-start mb-8 sticky top-0 bg-[#1a1a1a] z-10 py-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">ArcRunner <span className="text-blue-500 text-sm align-top">v0.2</span></h1>

          {/* Episode Tabs */}
          <div className="flex space-x-1 bg-black/30 p-1 rounded mb-2 inline-flex">
            {episodes.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentEpisode(i + 1); setSelectedIds(new Set()); }}
                className={`px-3 py-1 text-sm font-medium rounded transition font-light ${currentEpisode === i + 1
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                Ep {i + 1}
              </button>
            ))}
          </div>

          <div className="flex space-x-4 text-xs text-gray-400 uppercase tracking-widest">
            <span>Ep {currentEpisode}</span>
            <span>•</span>
            <span>{clips.length} Clips</span>
            <span>•</span>
            <span>{clips.filter(c => c.status === 'Done').length} Ready</span>
          </div>
          <div className="mt-4 flex space-x-2">
            <button
              onClick={handlePlayAll}
              disabled={clips.filter(c => c.status === 'Done').length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded shadow transition flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>Play All ({clips.filter(c => c.status === 'Done').length})</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-4">
          <span className="text-sm text-gray-400 font-light">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleGenerateSelected}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded shadow transition"
            >
              Generate Selected
            </button>
            <button
              onClick={handleDownloadSelected}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded shadow transition"
            >
              Download
            </button>
            <button
              onClick={() => window.location.href = '/ingest'}
              className="px-4 py-2 bg-blue-600/20 text-blue-400 text-xs font-bold uppercase tracking-wider rounded hover:bg-blue-600/30 transition border border-blue-600/50"
            >
              Import Script
            </button>
            <button
              onClick={() => {
                setLoading(true);
                fetch('/api/clips')
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.error) throw new Error(data.error);
                    setClips(data.clips);
                  })
                  .catch((err) => setError(err.message))
                  .finally(() => setLoading(false));
              }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold uppercase tracking-wider rounded shadow transition border border-gray-700"
            >
              Refresh Status
            </button>
          </div>
        </div>
      </header>

      <main>
        {loading ? (
          <div className="text-center py-20 text-gray-500 animate-pulse font-light">Loading clips...</div>
        ) : error ? (
          <div className="text-center py-20 text-red-400 font-light">Error: {error}</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800 bg-[#111]">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-white text-black uppercase text-xs sticky top-0 z-20">
                <tr>
                  <th className="p-3 w-10 text-center border-b border-gray-300">
                    <input
                      type="checkbox"
                      onChange={toggleSelectAll}
                      checked={activeClips.length > 0 && selectedIds.size === activeClips.length}
                      className="appearance-none w-4 h-4 border border-gray-400 rounded bg-transparent checked:bg-blue-500 checked:border-blue-500 cursor-pointer relative"
                    />
                  </th>
                  <th className="p-3 w-16 border-b border-gray-300 text-left text-black font-light" style={{ fontWeight: 300, color: 'black', textAlign: 'left', fontSize: '12px' }}>Scn</th>
                  <th className="p-3 min-w-[500px] border-b border-gray-300 text-left text-black font-light" style={{ fontWeight: 300, color: 'black', textAlign: 'left', fontSize: '12px' }}>Title</th>
                  <th className="p-3 w-24 border-b border-gray-300 text-left text-black font-light" style={{ fontWeight: 300, color: 'black', textAlign: 'left', fontSize: '12px' }}>Status</th>
                  <th className="p-3 w-48 border-b border-gray-300 text-left text-black font-light" style={{ fontWeight: 300, color: 'black', textAlign: 'left', fontSize: '12px' }}>Characters</th>
                  <th className="p-3 w-48 border-b border-gray-300 text-left text-black font-light" style={{ fontWeight: 300, color: 'black', textAlign: 'left', fontSize: '12px' }}>Location</th>
                  <th className="p-3 min-w-[300px] border-b border-gray-300 text-left text-black font-light" style={{ fontWeight: 300, color: 'black', textAlign: 'left', fontSize: '12px' }}>Action</th>
                  <th className="p-3 min-w-[300px] border-b border-gray-300 text-left text-black font-light" style={{ fontWeight: 300, color: 'black', textAlign: 'left', fontSize: '12px' }}>Dialog</th>
                  <th className="p-3 w-32 border-b border-gray-300 text-left text-black font-light" style={{ fontWeight: 300, color: 'black', textAlign: 'left', fontSize: '12px' }}>Ref Images</th>
                  <th className="p-3 w-24 border-b border-gray-300 text-left text-black font-light" style={{ fontWeight: 300, color: 'black', textAlign: 'left', fontSize: '12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {activeClips.map((clip) => {
                  const index = clips.findIndex(c => c.id === clip.id); // Global index
                  return (
                    <tr key={clip.id} className={`hover:bg-white/5 transition ${selectedIds.has(clip.id) ? 'bg-blue-900/20' : ''}`} style={{ verticalAlign: 'top', borderBottom: '1px solid black' }}>
                      <td className="text-center" style={{ verticalAlign: 'top', padding: '12px 8px', fontSize: '12px' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(clip.id)}
                          onChange={() => toggleSelect(clip.id)}
                          className="appearance-none w-4 h-4 border border-white rounded bg-transparent checked:bg-blue-500 checked:border-blue-500 cursor-pointer relative"
                        />
                      </td>
                      <td className="text-gray-400" style={{ verticalAlign: 'top', padding: '12px 8px', fontSize: '12px', fontWeight: 'bold' }}>{clip.scene}</td>
                      <td className="text-gray-200" title={clip.title} style={{ verticalAlign: 'top', padding: '12px 8px', fontSize: '12px', fontWeight: 'bold' }}>{clip.title}</td>
                      <td className="" style={{ verticalAlign: 'top', padding: '12px 8px', fontSize: '12px', fontWeight: 300 }}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${clip.status === 'Done' ? 'bg-green-900 text-green-300' :
                          clip.status === 'Generating' ? 'bg-yellow-900 text-yellow-300 animate-pulse' :
                            'bg-gray-800 text-gray-400'
                          }`}>
                          {clip.status}
                        </span>
                      </td>
                      <td className="text-gray-400" title={clip.character} style={{ verticalAlign: 'top', padding: '12px 8px', fontSize: '12px', fontWeight: 300 }}>{clip.character}</td>
                      <td className="text-gray-400" title={clip.location} style={{ verticalAlign: 'top', padding: '12px 8px', fontSize: '12px', fontWeight: 300 }}>{clip.location}</td>
                      <td className="text-gray-300 leading-relaxed" style={{ verticalAlign: 'top', padding: '12px 8px', fontSize: '12px', fontWeight: 300 }}>{clip.action}</td>
                      <td className="text-gray-400 italic leading-relaxed" style={{ verticalAlign: 'top', padding: '12px 8px', fontSize: '12px', fontWeight: 300 }}>{clip.dialog}</td>
                      <td className="" style={{ verticalAlign: 'top', padding: '12px 8px' }}>
                        <div className="flex space-x-2 overflow-hidden">
                          {clip.refImageUrls ? clip.refImageUrls.split(',').slice(0, 3).map((url, i) => (
                            <img
                              key={i}
                              src={`/api/proxy-image?url=${encodeURIComponent(url.trim())}`}
                              alt="Ref"
                              referrerPolicy="no-referrer"
                              className="inline-block rounded-md ring-1 ring-gray-700 object-contain bg-gray-900"
                              style={{ height: '40px', width: 'auto' }}
                            />
                          )) : <span className="text-gray-700 font-light">-</span>}
                          {clip.refImageUrls && clip.refImageUrls.split(',').length > 3 && (
                            <span className="inline-flex items-center justify-center rounded-md bg-gray-800 text-xs text-gray-400" style={{ height: '40px', width: '32px' }}>
                              +{clip.refImageUrls.split(',').length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="" style={{ verticalAlign: 'top', padding: '12px 8px' }}>
                        {clip.status === 'Done' && clip.resultUrl ? (
                          <button
                            onClick={() => setPlayingVideoUrl(clip.resultUrl)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow transition inline-block"
                          >
                            PLAY
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGenerate(clip, index)}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded shadow transition"
                            title="Generate Single"
                          >
                            GEN
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
