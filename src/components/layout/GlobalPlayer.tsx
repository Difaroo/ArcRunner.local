import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useMediaArchiver } from "@/hooks/useMediaArchiver";

export function GlobalPlayer() {
    const {
        playingVideoUrl,
        playingClipId,
        clips,
        setPlayingClip,
        playlist,
        currentPlayIndex,
        setCurrentPlayIndex,
        setClips
    } = useStore();

    const handleClose = () => setPlayingClip(null, null);

    // Player Navigation
    const handlePrevVideo = () => {
        if (currentPlayIndex > 0) {
            setCurrentPlayIndex(currentPlayIndex - 1);
            // Note: To support "playingClipId" in playlist nav, we'd need a playlist of objects, not URLs.
            // For now, we only update the URL, so editing might be disabled if navigating via playlist
            // unless we fix the playlist system.
            // Current system: playlist is just string[]. 
            // We'll keep URL update, but lose ID context on prev/next for now.
            // If user wants to edit, they should play specific clip.
            setPlayingClip(null, playlist[currentPlayIndex - 1]);
        }
    };

    const handleNextVideo = () => {
        if (currentPlayIndex < playlist.length - 1) {
            setCurrentPlayIndex(currentPlayIndex + 1);
            setPlayingClip(null, playlist[currentPlayIndex + 1]);
        }
    };

    // --- Edit Logic ---
    const [actionText, setActionText] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const currentClip = clips.find(c => c.id === playingClipId);

    // Sync action when clip changes
    useEffect(() => {
        if (currentClip) {
            setActionText(currentClip.action || "");
        }
    }, [currentClip, playingClipId]);

    const handleSaveAction = async () => {
        if (!playingClipId) return;
        setIsSaving(true);
        try {
            const updates = { action: actionText };
            await fetch('/api/update_clip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex: playingClipId, updates }),
            });

            // Optimistic update
            setClips(prev => prev.map(c => c.id === playingClipId ? { ...c, ...updates } : c));
        } catch (e) {
            console.error("Failed to save action", e);
            alert("Failed to save action");
        } finally {
            setIsSaving(false);
        }
    };

    // Archiver Logic (Save Reference)
    // We can't easily use the hook here because it requires setup we don't want to duplicate?
    // Actually, useMediaArchiver is a hook, we can use it.
    const { archiveMedia, isArchiving } = useMediaArchiver({
        clips: [], setClips: () => { }, // Mocked, as we don't need these strictly for archiveMedia(url)
        libraryItems: [], setLibraryItems: () => { },
        onClipSave: async () => { }, onLibrarySave: async () => { },
        setPlayingVideoUrl: () => { } // Unused in archiveMedia
    });


    return (
        <Dialog open={!!playingVideoUrl} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-6xl w-full p-0 bg-black border-stone-800 overflow-hidden flex flex-col h-[85vh]">
                <div className="relative flex-1 bg-black flex items-center justify-center group h-full overflow-hidden">
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

                {/* Player Footer (Actions & Edit) */}
                <div className="p-4 bg-stone-900 border-t border-stone-800 flex justify-between items-start gap-4">
                    {/* Edit Description Section */}
                    {currentClip ? (
                        <div className="flex-1 flex gap-2">
                            <textarea
                                value={actionText}
                                onChange={(e) => setActionText(e.target.value)}
                                placeholder="Clip Action/Description..."
                                className="flex-1 bg-stone-950 border border-stone-800 rounded p-2 text-sm text-stone-300 focus:outline-none focus:border-stone-600 resize-none h-20"
                            />
                            <div className="flex flex-col gap-2">
                                <Button variant="default" size="sm" onClick={handleSaveAction} disabled={isSaving || actionText === currentClip.action}>
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined">save</span>}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-stone-400 font-mono truncate max-w-md self-center">
                            {playingVideoUrl?.split('/').pop()}
                        </div>
                    )}


                    <div className="flex flex-col gap-2 self-start">
                        <Button variant="outline" size="sm" onClick={() => archiveMedia(playingVideoUrl!)}>
                            {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined">save</span>}
                            <span className="ml-2">Save Ref</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleClose}>Close</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
