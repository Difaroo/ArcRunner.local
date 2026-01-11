import { useState } from 'react';
import { Clip } from '@/types';
import { LibraryItem } from '@/lib/library'; // Assuming shared type

interface UseMediaArchiverProps {
    clips: Clip[];
    setClips: React.Dispatch<React.SetStateAction<Clip[]>>;
    libraryItems: LibraryItem[];
    setLibraryItems: React.Dispatch<React.SetStateAction<LibraryItem[]>>;
    onClipSave: (id: string, updates: Partial<Clip>) => Promise<void>;
    onLibrarySave: (id: string, updates: Partial<LibraryItem>) => Promise<void>;
    setPlayingVideoUrl?: (url: string) => void;
}

export function useMediaArchiver({
    clips,
    setClips,
    libraryItems,
    setLibraryItems,
    onClipSave,
    onLibrarySave,
    setPlayingVideoUrl
}: UseMediaArchiverProps) {
    const [isArchiving, setIsArchiving] = useState(false);

    const archiveMedia = async (currentUrl: string | null) => {
        if (!currentUrl) return;

        setIsArchiving(true);
        try {
            // 1. Find Owner
            const clip = clips.find(c => c.resultUrl === currentUrl);
            const libItem = libraryItems.find(l => l.refImageUrl === currentUrl);

            if (!clip && !libItem) {
                alert("Could not find source item for this media.");
                return;
            }

            // 2. Localize (Download if Remote)
            let finalUrl = currentUrl;
            if (!currentUrl.startsWith('/api/media')) {
                try {
                    // Try direct fetch first
                    let res;
                    try {
                        res = await fetch(currentUrl);
                        if (!res.ok) throw new Error('Direct fetch failed');
                    } catch (directErr) {
                        // If Direct Failure (CORS or Network), fallback to Proxy
                        console.log("Direct fetch failed, trying proxy...", directErr);
                        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(currentUrl)}`;
                        res = await fetch(proxyUrl);
                        if (!res.ok) throw new Error(`Proxy fetch failed: ${res.statusText}`);
                    }
                    const blob = await res.blob();
                    const type = blob.type;

                    // Generate a name
                    let name = `ref_ingest_${Date.now()}`;
                    if (clip) name = `Clip_${clip.id}_Ref`; // Basic naming, storage.ts handles dedup
                    if (libItem) name = `Lib_${libItem.id}_Ref`;

                    let ext = 'bin';
                    if (type.includes('jpeg') || type.includes('jpg')) ext = 'jpg';
                    else if (type.includes('png')) ext = 'png';
                    else if (type.includes('webp')) ext = 'webp';
                    else if (type.includes('mp4')) ext = 'mp4';

                    const file = new File([blob], `${name}.${ext}`, { type });
                    const formData = new FormData();
                    formData.append('file', file);

                    // Upload (supports deduplication via backend)
                    const upRes = await fetch('/api/upload', { method: 'POST', body: formData });
                    const upData = await upRes.json();

                    if (upData.url) {
                        finalUrl = upData.url;
                    } else {
                        throw new Error("Upload failed");
                    }
                } catch (err) {
                    console.error("Ingest failed", err);
                    alert("Failed to save locally.");
                    return;
                }
            }

            // 3. Update & Link
            if (clip) {
                // A) Update Result Link (Make Permanent)
                const updates: Partial<Clip> = {};
                if (clip.resultUrl !== finalUrl) {
                    updates.resultUrl = finalUrl;
                }

                // B) Append to Refs
                const currentRefs = clip.refImageUrls || '';
                // Check if already in refs
                if (!currentRefs.includes(finalUrl)) {
                    updates.refImageUrls = currentRefs ? `${currentRefs}, ${finalUrl}` : finalUrl;
                }

                // C) Set Status to Saved
                updates.status = 'Saved';

                // Apply Updates
                setClips(prev => prev.map(c => c.id === clip.id ? { ...c, ...updates } : c));
                await onClipSave(clip.id, updates);

                // Update player if result changed
                if (updates.resultUrl && setPlayingVideoUrl) {
                    setPlayingVideoUrl(updates.resultUrl);
                }

                alert("Saved to Storage & Added to Refs!");

            } else if (libItem) {
                // Library Logic (Append)
                const currentRefs = libItem.refImageUrl || '';

                if (currentRefs.includes(finalUrl)) {
                    alert("Reference is already up to date.");
                    return;
                }

                const newRefs = currentRefs ? `${currentRefs}, ${finalUrl}` : finalUrl;
                setLibraryItems(prev => prev.map(l => l.id === libItem.id ? { ...l, refImageUrl: newRefs } : l));
                await onLibrarySave(libItem.id, { refImageUrl: newRefs });

                alert("Added to Library References!");
            }

        } catch (error) {
            console.error("Archive error:", error);
            alert("An error occurred while saving.");
        } finally {
            setIsArchiving(false);
        }
    };

    return { archiveMedia, isArchiving };
}
