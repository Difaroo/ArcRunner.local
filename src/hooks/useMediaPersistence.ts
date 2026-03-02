import { useState } from 'react';

interface UseMediaPersistenceProps {
    clipId?: string; // Optional: If persisting a Clip
    episodeId?: string; // Optional: If persisting a Clip (Context)
    mediaId?: string; // Optional: If persisting a specific Media item (Future)
    url?: string; // Optional: Direct URL if no ID
}

export function useMediaPersistence() {
    const [isPersisting, setIsPersisting] = useState(false);

    const persistMedia = async (params: { clipId?: string, episodeId?: string, url?: string }) => {
        if (isPersisting) return { success: false };
        setIsPersisting(true);

        try {
            // 1. Initial Persist Attempt
            // We need clipId and episodeId for the current API architecture
            if (!params.clipId || !params.episodeId) {
                console.error("Persistence requires clipId and episodeId");
                return { success: false, error: "Missing ID" };
            }

            let res = await fetch('/api/media/persist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clipId: params.clipId, episodeId: params.episodeId, url: params.url })
            });

            // 2. Handle Missing Path (400) -> Open Finder
            if (res.status === 400) {
                const data = await res.json();
                if (data.error && data.error.includes('No persistence path')) {

                    const pickRes = await fetch('/api/system/pick-folder', { method: 'POST' });
                    const pickData = await pickRes.json();

                    if (pickData.cancelled) {
                        return { success: false, cancelled: true };
                    }

                    if (pickData.path) {
                        // 3. Retry with new path
                        res = await fetch('/api/media/persist', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                clipId: params.clipId,
                                episodeId: params.episodeId,
                                customPath: pickData.path
                            })
                        });
                    }
                }
            }

            if (!res.ok) throw new Error('Persistence failed');

            const result = await res.json();
            return { success: true, path: result.localPath, alias: result.aliasPath };

        } catch (error) {
            console.error('Persistence Error:', error);
            // alert('Failed to persist. Check server.') // Let caller handle UI feedback if they want
            return { success: false, error };
        } finally {
            setIsPersisting(false);
        }
    };

    return {
        persistMedia,
        isPersisting
    };
}
