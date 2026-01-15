'use client';

import React, { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NavBar } from "@/components/NavBar";
import { MainHeader } from "@/components/MainHeader";
import { PageHeader } from '@/components/PageHeader';
import { MediaGrid } from '@/components/media/MediaGrid';
import { UniversalMediaViewer } from "@/components/media/UniversalMediaViewer";
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { deleteMedia, MediaFilter } from '@/app/actions/media';
import { EpisodeTabs } from "@/components/clips/EpisodeTabs";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from 'lucide-react';

import { getClipFilename } from '@/lib/download-utils';

interface MediaGalleryClientProps {
    initialItems: any[];
    initialTotal: number;
    initialFilter: MediaFilter;
    title: string;
    seriesList: any[];
    episodeList: any[];
}

export function MediaGalleryClient({ initialItems, initialTotal, initialFilter, title, seriesList, episodeList }: MediaGalleryClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    React.useEffect(() => {
        // Automatically default to stored Series/Episode if URL is clean
        if (initialFilter.seriesId || initialFilter.episodeId || initialFilter.type || initialFilter.category) return;

        const savedSeriesId = localStorage.getItem('arcrunner_currentSeriesId');
        const savedEpNum = localStorage.getItem('arcrunner_currentEpisode');

        if (savedSeriesId) {
            const params = new URLSearchParams(window.location.search);
            params.set('seriesId', savedSeriesId);

            if (savedEpNum) {
                // Find matching episode UUID for this series
                // Note: savedEpNum is "1" (int), episodeList has { number: int, seriesId: uuid }
                const ep = episodeList.find(e => e.seriesId === savedSeriesId && e.number === parseInt(savedEpNum));
                if (ep) {
                    params.set('episodeId', ep.id);
                }
            }

            router.replace(`/media?${params.toString()}`);
        }
    }, [seriesList, episodeList, router, initialFilter]); // Dependency array: Run when lists are ready, but mostly on mount logic via checks

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this media? This will break any clips using it.')) return;

        try {
            await deleteMedia(id);
            router.refresh();
        } catch (e) {
            alert('Delete Failed');
        }
    };

    const handleFilterChange = (key: keyof MediaFilter, value: string | undefined) => {
        const params = new URLSearchParams(window.location.search);

        // Logic: specific handling for Series vs Episode dependencies
        if (key === 'seriesId') {
            if (value) {
                params.set('seriesId', value);
                params.delete('episodeId'); // Reset episode when series changes
            } else {
                params.delete('seriesId');
                params.delete('episodeId');
            }
        }
        else if (key === 'episodeId') {
            if (value) params.set('episodeId', value);
            else params.delete('episodeId');
        }
        else {
            if (value) params.set(key, value);
            else params.delete(key);
        }

        router.push(`/media?${params.toString()}`);
    };

    // Derived Logic for Filters
    const selectedSeries = seriesList.find(s => s.id === initialFilter.seriesId);

    // Series-specific episodes
    const visibleEpisodes = initialFilter.seriesId
        ? episodeList.filter(e => e.seriesId === initialFilter.seriesId)
        : [];

    // Map for EpisodeTabs
    const episodeKeys = visibleEpisodes.map(e => e.number.toString());
    const episodeTitles = visibleEpisodes.reduce((acc, e) => {
        acc[e.number.toString()] = e.title || '';
        return acc;
    }, {} as Record<string, string>);

    // Handle Tab Change
    const handleEpisodeTabChange = (epNum: number) => {
        const ep = visibleEpisodes.find(e => e.number === epNum);
        if (ep) handleFilterChange('episodeId', ep.id);
    };

    // Determine 'currentEpisode' number from ID
    const currentEpNumber = initialFilter.episodeId
        ? episodeList.find(e => e.id === initialFilter.episodeId)?.number
        : 0;

    // --- Viewer Logic ---
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerPlaylist, setViewerPlaylist] = useState<any[]>([]);
    const [viewerIndex, setViewerIndex] = useState(0);

    const handleSelect = (media: any) => {
        // Construct full playlist from initialItems
        // We map ALL items to UniversalMediaItem format
        const playlist = initialItems.map(item => {
            let itemTitle = 'Media';

            if (item.resultForClip) {
                // Try to resolve Series Name from SeriesList if possible
                const seriesId = episodeList.find(e => e.id === item.resultForClip.episodeId)?.seriesId;
                const sName = seriesList.find(s => s.id === seriesId)?.name || 'Series';

                // Use Standardized Filename (strip extension for Display Title)
                itemTitle = getClipFilename(item.resultForClip, sName).replace(/\.[^/.]+$/, "");
            } else if (item.studioItem) {
                itemTitle = item.studioItem.name;
            }

            return {
                id: item.id,
                url: item.localPath || item.url || '', // Prefer local path
                type: item.type === 'VIDEO' ? 'video' : 'image',
                title: itemTitle,
                canDelete: true, // Allow deletion from viewer
                isReference: false // In Gallery, all are "roots"
            };
        }).filter(u => u.url); // filter invalid

        const index = playlist.findIndex(p => p.id === media.id);

        setViewerPlaylist(playlist);
        setViewerIndex(index >= 0 ? index : 0);
        setViewerOpen(true);
    };

    return (
        <div className="flex h-screen flex-col bg-background">
            {/* 1. ArcRunner Branding Header */}
            <MainHeader currentView="media" onViewChange={(v) => {
                if (v === 'media') return;
                window.location.href = '/?view=' + v;
            }} />

            {/* 2. Global Navigation (Standard) */}
            {/* NavBar Removed - MainHeader handles Global Nav */}

            {/* 2. Navigation Toolbar (Standard Tabs) */}
            <div className="flex flex-col border-b border-border/40 bg-background/50 backdrop-blur-sm print:hidden">
                <div className="flex items-center justify-between px-6 h-[45px]">
                    {initialFilter.seriesId ? (
                        <EpisodeTabs
                            episodeKeys={episodeKeys}
                            currentEpisode={currentEpNumber || 0}
                            episodeTitles={episodeTitles}
                            onEpisodeChange={handleEpisodeTabChange}
                        />
                    ) : (
                        <div className="text-sm text-muted-foreground italic py-3">Select a Series to view Episodes</div>
                    )}
                </div>
            </div>

            {/* 2. Page Header (Context + Actions) */}
            <PageHeader title={
                <div className="flex items-center justify-start gap-2 w-fit whitespace-nowrap">
                    <span className="font-normal text-muted-foreground">{selectedSeries?.name || 'All Series'}</span>
                    {selectedSeries && (
                        <>
                            <span className="text-stone-700">/</span>
                            <span className="text-foreground">
                                {episodeTitles[currentEpNumber.toString()]
                                    ? episodeTitles[currentEpNumber.toString()]
                                    : (currentEpNumber > 0 ? `Episode ${currentEpNumber}` : "All Episodes")}
                            </span>
                        </>
                    )}
                    <span className="ml-4 text-xs text-muted-foreground font-normal border-l border-white/10 pl-4">{initialTotal} items</span>
                </div>
            }>
                <div className="flex items-center gap-2">
                    {/* SERIES FILTER */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-2 min-w-[140px] justify-between">
                                <span className="flex items-center truncate">
                                    <span className="text-zinc-500 font-semibold mr-2">SERIES</span>
                                    {selectedSeries ? selectedSeries.name : "All Series"}
                                </span>
                                <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto bg-stone-900 border-stone-800 text-white">
                            <DropdownMenuItem onClick={() => handleFilterChange('seriesId', undefined)} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                                All Series
                            </DropdownMenuItem>
                            {seriesList.map(s => (
                                <DropdownMenuItem key={s.id} onClick={() => handleFilterChange('seriesId', s.id)} className="focus:bg-stone-800 focus:text-white cursor-pointer">
                                    {s.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Separator orientation="vertical" className="h-6" />

                    {/* TYPE FILTERS (Grouped) */}
                    <div className="flex items-center h-8 gap-1 border border-zinc-700 rounded-md px-1.5 bg-background/50">
                        <Button
                            variant={initialFilter.type === undefined ? 'outline' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('type', undefined)}
                            className={`h-5 px-2 text-[9px] ${!initialFilter.type ? 'border-orange-500 text-orange-500 bg-orange-500/10' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            All
                        </Button>
                        <Button
                            variant={initialFilter.type === 'VIDEO' ? 'outline' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('type', 'VIDEO')}
                            className={`h-5 px-2 text-[9px] ${initialFilter.type === 'VIDEO' ? 'border-orange-500 text-orange-500 bg-orange-500/10' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            Video
                        </Button>
                        <Button
                            variant={initialFilter.type === 'IMAGE' ? 'outline' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('type', 'IMAGE')}
                            className={`h-5 px-2 text-[9px] ${initialFilter.type === 'IMAGE' ? 'border-orange-500 text-orange-500 bg-orange-500/10' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            Image
                        </Button>
                    </div>

                    <Separator orientation="vertical" className="h-6" />

                    {/* SOURCE FILTERS (Grouped) */}
                    <div className="flex items-center h-8 gap-1 border border-zinc-700 rounded-md px-1.5 bg-background/50">
                        <Button
                            variant={initialFilter.category === undefined ? 'outline' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('category', undefined)}
                            className={`h-5 px-2 text-[9px] ${!initialFilter.category ? 'border-orange-500 text-orange-500 bg-orange-500/10' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            All Sources
                        </Button>
                        <Button
                            variant={initialFilter.category === 'RESULT' ? 'outline' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('category', 'RESULT')}
                            className={`h-5 px-2 text-[9px] ${initialFilter.category === 'RESULT' ? 'border-orange-500 text-orange-500 bg-orange-500/10' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            Results
                        </Button>
                        <Button
                            variant={initialFilter.category === 'REFERENCE' ? 'outline' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('category', 'REFERENCE')}
                            className={`h-5 px-2 text-[9px] ${initialFilter.category === 'REFERENCE' ? 'border-orange-500 text-orange-500 bg-orange-500/10' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                            Reference
                        </Button>
                    </div>
                </div>
            </PageHeader>

            {/* 3. Grid Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <MediaGrid
                    items={initialItems}
                    onDelete={handleDelete}
                    onSelect={handleSelect} // Pass usage logic
                />

                {initialItems.length === 0 && (
                    <div className="mt-10 text-center">
                        <p className="text-muted-foreground">No media found matching filters.</p>
                        <Button variant="link" onClick={() => router.push('/media')}>Clear Filters</Button>
                    </div>
                )}
            </div>

            {/* Viewer */}
            <UniversalMediaViewer
                isOpen={viewerOpen}
                onClose={() => setViewerOpen(false)}
                playlist={viewerPlaylist}
                initialIndex={viewerIndex}
                onDelete={handleDelete} // Re-use delete logic
            />
        </div>
    );
}
