'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type ViewType = 'series' | 'script' | 'library' | 'clips' | 'settings' | 'storyboard' | 'media';

interface MainHeaderProps {
    currentView?: string;
    onViewChange?: (view: string) => void;
    loading?: boolean;
    error?: string | null;
}

export function MainHeader({ currentView, onViewChange, loading, error }: MainHeaderProps) {
    const pathname = usePathname();

    // Determine active state if not passed explicitly (Fallback to path)
    const active = currentView || (pathname === '/media' ? 'media' : 'series');

    const handleNav = (view: string) => {
        if (onViewChange) {
            onViewChange(view);
        } else {
            // Default Routing behavior for Media page
            if (view === 'media') window.location.href = '/media';
            else window.location.href = '/?view=' + view;
        }
    };

    const navItems: { id: ViewType, label: string, tooltip: string }[] = [
        { id: 'series', label: 'Series', tooltip: 'View Series Settings' },
        { id: 'script', label: 'Script', tooltip: 'View Script Ingestion' },
        { id: 'library', label: 'Studio', tooltip: 'View Studio Assets' },
        { id: 'clips', label: 'Episode', tooltip: 'View Episode Clips' },
        { id: 'media', label: 'Media', tooltip: 'View Media Library' },
        { id: 'storyboard', label: 'Storyboard', tooltip: 'View Storyboard' },
        { id: 'settings', label: 'Settings', tooltip: 'View Settings' },
    ];

    return (
        <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-md px-6">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-foreground">ArcRunner</h1>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">0.17.1 Falcon</span>
                </div>

                <div className="h-6 w-px bg-border/40 mx-2"></div>

                <nav className="flex items-center space-x-1">
                    {navItems.map((item) => (
                        <TooltipProvider key={item.id}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={active === item.id ? 'secondary' : 'ghost'}
                                        size="sm"
                                        onClick={() => handleNav(item.id)}
                                        className={`text-xs ${active === item.id ? 'bg-stone-800 text-white' : 'text-stone-500'}`}
                                    >
                                        {item.label}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{item.tooltip}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ))}
                </nav>
            </div>

            {/* Right Side: Status */}
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
        </header>
    );
}
