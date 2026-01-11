import React from 'react';
import { fetchMedia, MediaFilter } from '@/app/actions/media';
import { MediaGalleryClient } from './client';
import { db } from '@/lib/db';

export default async function MediaPage({ searchParams }: { searchParams: { seriesId?: string, episodeId?: string, type?: string, category?: string } }) {

    // 1. Resolve Filters
    const filter: MediaFilter = {
        seriesId: searchParams.seriesId,
        episodeId: searchParams.episodeId,
        type: searchParams.type as any,
        category: searchParams.category as any
    };

    // 2. Fetch Initial Data
    const { items, total } = await fetchMedia(filter);

    // 3. Fetch Context for Header
    let title = 'Global Media Library';
    if (filter.seriesId) {
        const s = await db.series.findUnique({ where: { id: filter.seriesId } });
        title = s ? `${s.name} Media` : title;
    }

    // 4. Fetch Filters Lists
    const seriesList = await db.series.findMany({ orderBy: { name: 'asc' } });
    const episodeList = await db.episode.findMany({ orderBy: { number: 'asc' } });

    return (
        <main className="flex h-screen flex-col bg-background text-foreground">
            <MediaGalleryClient
                initialItems={items}
                initialTotal={total}
                initialFilter={filter}
                title={title}
                seriesList={seriesList}
                episodeList={episodeList}
            />
        </main>
    );
}
