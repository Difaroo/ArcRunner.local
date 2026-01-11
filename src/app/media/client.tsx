'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NavBar } from "@/components/NavBar";
import { MainHeader } from "@/components/MainHeader";
import { PageHeader } from '@/components/PageHeader';
import { MediaGrid } from '@/components/media/MediaGrid';
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

    return (
        <div className="flex h-screen flex-col bg-background">
            {/* 1. ArcRunner Branding Header */}
            <MainHeader currentView="media" onViewChange={(v) => {
                if (v === 'media') return;
                window.location.href = '/?view=' + v;
            }} />

            {/* 2. Global Navigation (Standard) */}
            <NavBar
                currentView="media"
                onViewChange={(view) => {
                    if (view === 'media') return;
                    // Standard routing for other views
                    window.location.href = '/?view=' + view;
                }}
            />

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
                            <Button variant="outline" size="sm" className="h-8 gap-1 min-w-[120px] justify-between">
                                {selectedSeries ? selectedSeries.name : "All Series"}
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto">
                            <DropdownMenuItem onClick={() => handleFilterChange('seriesId', undefined)}>
                                All Series
                            </DropdownMenuItem>
                            {seriesList.map(s => (
                                <DropdownMenuItem key={s.id} onClick={() => handleFilterChange('seriesId', s.id)}>
                                    {s.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>



                    <Separator orientation="vertical" className="h-6" />

                    {/* TYPE FILTERS */}
                    <div className="flex items-center bg-muted/50 rounded-md border p-1">
                        <Button
                            variant={initialFilter.type === undefined ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('type', undefined)}
                            className="h-7 text-xs"
                        >
                            All
                        </Button>
                        <Separator orientation="vertical" className="h-4 mx-1" />
                        <Button
                            variant={initialFilter.type === 'VIDEO' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('type', 'VIDEO')}
                            className="h-7 text-xs"
                        >
                            Video
                        </Button>
                        <Button
                            variant={initialFilter.type === 'IMAGE' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('type', 'IMAGE')}
                            className="h-7 text-xs"
                        >
                            Image
                        </Button>
                    </div>

                    <Separator orientation="vertical" className="h-6" />

                    {/* SOURCE FILTERS */}
                    <div className="flex items-center bg-muted/50 rounded-md border p-1">
                        <Button
                            variant={initialFilter.category === undefined ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('category', undefined)}
                            className="h-7 text-xs"
                        >
                            All Sources
                        </Button>
                        <Separator orientation="vertical" className="h-4 mx-1" />
                        <Button
                            variant={initialFilter.category === 'RESULT' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('category', 'RESULT')}
                            className="h-7 text-xs"
                        >
                            Results
                        </Button>
                        <Button
                            variant={initialFilter.category === 'REFERENCE' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => handleFilterChange('category', 'REFERENCE')}
                            className="h-7 text-xs"
                        >
                            Reference
                        </Button>
                    </div>
                </div>
            </PageHeader>

            {/* 3. Grid Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <MediaGrid items={initialItems} onDelete={handleDelete} />

                {initialItems.length === 0 && (
                    <div className="mt-10 text-center">
                        <p className="text-muted-foreground">No media found matching filters.</p>
                        <Button variant="link" onClick={() => router.push('/media')}>Clear Filters</Button>
                    </div>
                )}
            </div>
        </div>
    );
}
