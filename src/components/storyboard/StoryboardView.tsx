import { Clip } from "@/types"
import { useState } from "react"
import { StoryboardCard } from "./StoryboardCard"

interface StoryboardViewProps {
    clips: Clip[]
    // We can pass local hiding state or manage it here if it's transient/persisted via API
    onToggleHide: (clipId: string, hidden: boolean) => void
    printLayout: '3x2' | '6x1' | 'auto'
    seriesTitle?: string
    episodeTitle?: string
    episodeNumber?: string
}

export function StoryboardView({ clips, onToggleHide, printLayout, seriesTitle = 'Series', episodeTitle = 'Episode', episodeNumber = '1' }: StoryboardViewProps) {
    // State lifted to page.tsx

    return (
        <div className="flex flex-col h-full bg-transparent text-stone-200 print:bg-transparent print:text-black print:overflow-visible overflow-hidden animate-in fade-in duration-300">
            {/* Dynamic Page Orientation for Print */}
            <style>
                {`
                    @media print {
                        @page {
                            /* Reset margin to 0 to hide browser headers/footers */
                            margin: 0;
                            size: ${printLayout === '3x2' ? 'landscape' : 'portrait'};
                        }
                        body {
                            -webkit-print-color-adjust: exact;
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


            {/* --- PRINT ONLY VIEW (Table for Repeating Header) --- */}
            <div className="hidden print:block w-full h-full bg-white text-black px-[10mm]">
                <table className="w-full">
                    <thead className="w-full">
                        <tr>
                            <td>
                                {/* Custom Print Header (Repeats on every page) */}
                                {/* pt-[15mm] simulates the top margin while keeping browser headers hidden */}
                                <div className="flex flex-col mb-4 font-sans w-full pt-[15mm]">
                                    {/* Top Row: Date | App Branding */}
                                    <div className="flex justify-between items-end mb-6 text-xs uppercase tracking-wide">
                                        <div className="font-light text-stone-500 tracking-wider">
                                            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
                                        </div>
                                        <div className="tracking-widest">
                                            <span className="font-bold text-red-600">ARC</span>
                                            <span className="font-light text-red-600">RUNNER</span>
                                            <div className="text-[10px] text-muted-foreground">v0.26.0</div>
                                        </div>
                                    </div>

                                    {/* Main Title Row: Series / Episode */}
                                    <div className="flex items-baseline gap-2 border-stone-400 pb-2 w-full" style={{ borderBottomWidth: '0.5px' }}>
                                        <h1 className="text-2xl font-medium text-black tracking-tight leading-none">
                                            {seriesTitle}
                                        </h1>
                                        <span className="text-2xl font-light text-stone-400 leading-none">/</span>
                                        <h2 className="text-2xl font-normal text-stone-400 tracking-tight leading-none">
                                            {episodeNumber} {episodeTitle}
                                        </h2>
                                    </div>
                                    {/* Spacer for content separation */}
                                    <div className="h-4"></div>
                                </div>
                            </td>
                        </tr>
                    </thead>
                    <tbody className="w-full">
                        <tr>
                            <td>
                                <div className={`
                                    grid w-full
                                    ${printLayout === '3x2' ? 'grid-cols-3 gap-y-8 gap-x-8 landscape-grid' : ''}
                                    ${printLayout === '6x1' ? 'grid-cols-1 gap-0 portrait-list divide-y divide-gray-200' : ''}
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
                            </td>
                        </tr>
                    </tbody>
                    {/* Simulated Bottom Margin */}
                    <tfoot>
                        <tr>
                            <td className="h-[15mm]"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    )
}
