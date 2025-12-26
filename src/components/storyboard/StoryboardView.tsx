import { Clip } from "@/app/api/clips/route"
import { useState } from "react"
import { StoryboardCard } from "./StoryboardCard"

interface StoryboardViewProps {
    clips: Clip[]
    // We can pass local hiding state or manage it here if it's transient/persisted via API
    onToggleHide: (clipId: string, hidden: boolean) => void
    printLayout: '3x2' | '6x1' | 'auto'
}

export function StoryboardView({ clips, onToggleHide, printLayout }: StoryboardViewProps) {
    // State lifted to page.tsx

    return (
        <div className="flex flex-col h-full bg-transparent text-stone-200 print:bg-transparent print:text-black overflow-hidden animate-in fade-in duration-300">
            {/* Dynamic Page Orientation for Print */}
            <style>
                {`
                    @media print {
                        @page {
                            size: ${printLayout === '3x2' ? 'landscape' : 'portrait'};
                            margin: 14mm 9mm 0 9mm;
                        }
                    }
                `}
            </style>

            {/* --- SCREEN ONLY VIEW --- */}
            <div className="flex-1 overflow-y-auto p-8 print:hidden">
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                    {clips.map((clip) => (
                        <StoryboardCard
                            key={clip.id}
                            clip={clip}
                            onToggleHide={onToggleHide}
                            printLayout="3x2"
                        />
                    ))}
                </div>
            </div>


            {/* --- PRINT ONLY VIEW (Clean Grid) --- */}
            <div className="hidden print:block w-full h-full">
                <div className={`
                    grid 
                    ${printLayout === '3x2' ? 'grid-cols-3 gap-y-4 gap-x-16 landscape-grid' : ''}
                    ${printLayout === '6x1' ? 'grid-cols-1 gap-2 portrait-list' : ''}
                    ${printLayout === 'auto' ? 'grid-cols-3 gap-y-4 gap-x-16' : ''}
                `}>
                    {clips.map((clip) => (
                        <StoryboardCard
                            key={`print-${clip.id}`}
                            clip={clip}
                            onToggleHide={onToggleHide}
                            printLayout={printLayout}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
