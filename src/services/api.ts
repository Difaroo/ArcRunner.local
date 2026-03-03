/**
 * API Service Layer
 * Centralizes all raw `fetch` calls for standardized error handling and typing.
 */

// Generic fetch wrapper
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(endpoint, {
        ...options,
        headers: {
            'Content-Type': options?.body instanceof FormData ? '' : 'application/json',
            ...(options?.headers || {}),
        },
    });

    // Cleanup Content-Type if FormData is used (browser sets correct boundary)
    if (options?.body instanceof FormData && res.headers) {
        // @ts-ignore
        delete options.headers['Content-Type'];
    }

    if (!res.ok) {
        let errorMessage = `API Error: ${res.statusText}`;
        try {
            const data = await res.json();
            errorMessage = data.error || errorMessage;
        } catch (e) {
            // fallback
        }
        throw new Error(errorMessage);
    }

    try {
        const text = await res.text();
        return text ? JSON.parse(text) : ({} as T);
    } catch (e) {
        return {} as T;
    }
}

export const clipsApi = {
    getAll: () => apiFetch<any>('/api/clips', { cache: 'no-store' }),
    create: (data: any) => apiFetch<any>('/api/clips', { method: 'POST', body: JSON.stringify(data) }),
    update: (rowIndex: number, updates: any) => apiFetch<any>('/api/update_clip', { method: 'POST', body: JSON.stringify({ rowIndex, updates }) }),
    delete: (id: number, episodeId: string) => apiFetch<any>('/api/clips', { method: 'DELETE', body: JSON.stringify({ id, episodeId }) }),
    sort: (updates: { id: number; sortOrder: number }[]) => apiFetch<any>('/api/sort', { method: 'PATCH', body: JSON.stringify({ updates }) }),
    moveClips: (clipIds: number[], targetEpisodeId: string) => apiFetch<any>('/api/move-clips', { method: 'POST', body: JSON.stringify({ clipIds, targetEpisodeId }) })
};

export const seriesApi = {
    getAll: () => apiFetch<any>('/api/series', { cache: 'no-store' }),
    create: (data: any) => apiFetch<any>('/api/series', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, updates: any) => apiFetch<any>('/api/update_series', { method: 'POST', body: JSON.stringify({ id, ...updates }) }),
};

export const episodeApi = {
    getAll: (seriesId: string) => apiFetch<any>(`/api/episodes?seriesId=${seriesId}`, { cache: 'no-store' }),
    create: (data: any) => apiFetch<any>('/api/episodes', { method: 'POST', body: JSON.stringify(data) }),
    update: (seriesId: string, episodeId: string, updates: any) => apiFetch<any>('/api/update_episode', { method: 'POST', body: JSON.stringify({ seriesId, episodeId, updates }) }),
};

export const mediaApi = {
    addRef: (clipId: string, url: string, type: string) => apiFetch<any>('/api/media/add-ref', { method: 'POST', body: JSON.stringify({ clipId, url, type }) }),
    unlink: (clipId: string, url: string, category: string) => apiFetch<any>('/api/media/unlink', { method: 'POST', body: JSON.stringify({ clipId, url, category }) }),
    persist: (clipId: string, episodeId: string, url: string) => apiFetch<any>('/api/media/persist', { method: 'POST', body: JSON.stringify({ clipId, episodeId, url }) }),
};

export const libraryApi = {
    getAll: (seriesId: string, type?: string) => apiFetch<any>(`/api/library?seriesId=${seriesId}${type ? `&type=${type}` : ''}`, { cache: 'no-store' }),
    update: (rowIndex: string, updates: any) => apiFetch<any>('/api/update_library', { method: 'POST', body: JSON.stringify({ rowIndex, updates }) }),
};
