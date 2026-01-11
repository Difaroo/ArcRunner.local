'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type ViewType = 'series' | 'script' | 'library' | 'clips' | 'settings' | 'storyboard' | 'media';

interface NavBarProps {
    currentView: string;
    onViewChange: (view: any) => void;
    loading?: boolean;
    error?: string | null;
}

export function NavBar({ currentView, onViewChange, loading, error }: NavBarProps) {

    const navItems: { id: ViewType, label: string, tooltip: string }[] = [
        { id: 'series', label: 'Series', tooltip: 'View Series Settings' },
        { id: 'script', label: 'Script', tooltip: 'View Script Ingestion' },
        { id: 'library', label: 'Studio', tooltip: 'View Studio Assets' },
        { id: 'clips', label: 'Episode', tooltip: 'View Episode Clips' },
        { id: 'storyboard', label: 'Storyboard', tooltip: 'View Storyboard' },
        { id: 'settings', label: 'Settings', tooltip: 'View Settings' },
    ];

    return (
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-background/50 px-6 backdrop-blur-sm print:hidden">
            <div className="flex items-center gap-4">
                <nav className="flex items-center space-x-1">
                    {navItems.map((item) => (
                        <TooltipProvider key={item.id}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={currentView === item.id ? 'secondary' : 'ghost'}
                                        size="sm"
                                        onClick={() => onViewChange(item.id)}
                                        className={`text-xs ${currentView === item.id ? 'bg-stone-800 text-white' : 'text-stone-500'}`}
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
