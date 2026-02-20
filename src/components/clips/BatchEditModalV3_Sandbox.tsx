"use client";
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Clip } from "@/types";
import { MODEL_LIST, getModelConfig } from "@/lib/models";
// Mock Components to avoid complex dependencies
const ClipAssetScroller = ({ className, ...props }: any) => (
    <div className={`bg-blue-900/20 border border-blue-500/30 p-2 ${className}`}>
        Asset Scroller (Fills Remaining Space)
        <div className="flex gap-2 overflow-x-auto mt-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-44 aspect-video bg-blue-500/50 shrink-0">Img {i}</div>)}
        </div>
    </div>
);

const ModelInputSlotsV2 = ({ className, ...props }: any) => (
    <div className={`bg-green-900/20 border border-green-500/30 flex flex-row gap-1.5 overflow-x-auto pb-2 ${className}`}>
        {/* Flattened: Removed inner div */}
        {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col bg-stone-900/40 border border-stone-800 rounded-lg overflow-hidden aspect-[9/16] h-full w-auto">
                <div className="bg-stone-800 h-6 w-full">Reference #{i}</div>
                <div className="bg-black flex-1 w-full min-w-[80px]">Box</div>
            </div>
        ))}
    </div>
);

const VibesMenu = () => <div className="p-2">Vibes Menu</div>;

export function BatchEditModalSandbox() {
    const [activeField, setActiveField] = useState<string | null>(null);
    const [editValues, setEditValues] = useState({
        action: "A cinematic shot of a robot explicitly hugging the layout constraints.",
        dialog: "",
        character: "",
        location: "",
        camera: "",
        movement: "",
        negativePrompt: ""
    });

    const clip = { model: 'veo-fast' };
    const getModelConfig = () => ({ label: 'Veo Fast' });
    const mediaItems = Array(10).fill({}).map((_, i) => ({ id: i, refImageSort: 0 }));

    return (
        <div className="p-10 h-screen w-screen bg-black text-white">
            <div className="w-full h-[800px] border border-stone-700 bg-stone-950 p-4">
                {/* === SANDBOXED COMPONENT START === */}

                <div className="h-full grid grid-cols-[13rem_1fr_auto_1fr] grid-rows-[auto_1fr] gap-4 border border-yellow-500/30 relative">
                    {/* Debug Grid Overlay */}
                    <div className="absolute inset-0 grid grid-cols-[13rem_1fr_auto_1fr] grid-rows-[auto_1fr] gap-4 pointer-events-none opacity-20 z-50">
                        <div className="bg-red-500/30">C1 (13rem)</div>
                        <div className="bg-blue-500/30 text-center">C2 (1fr)</div>
                        <div className="bg-green-500/30 text-center">C3 (Auto)</div>
                        <div className="bg-purple-500/30 text-center">C4 (1fr)</div>
                        <div className="col-span-4 row-start-2 bg-white/10 text-center flex items-center justify-center">Row 2</div>
                    </div>

                    {/* Top Row: Asset Pool (Span 2 to cover Vibes + Col 1) */}
                    <div className="col-span-2 row-start-1 bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800 min-h-0">
                        <div className="px-3 pt-3 pb-1 flex justify-between items-center">
                            <h3 className="text-xs text-stone-400 font-medium uppercase tracking-wider">Asset Pool</h3>
                        </div>
                        <ClipAssetScroller
                            mediaItems={mediaItems}
                            orientation="horizontal"
                            className="flex-1 w-full"
                        />
                    </div>

                    {/* Top Row: Slots (Col 3 / Action) */}
                    <div className="col-start-3 row-start-1 bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800 w-fit justify-self-start border-red-500 border-4">
                        <div className="px-1.5 pt-3 pb-1">
                            <h3 className="text-xs text-stone-400 font-medium uppercase tracking-wider">VEO FAST</h3>
                        </div>
                        <ModelInputSlotsV2
                            modelConfig={{}}
                            mediaItems={[]}
                            onRemove={() => { }}
                            orientation="horizontal"
                            className="px-1.5 pb-2 pt-0 border-blue-500 border-4"
                        />
                    </div>

                    {/* Top Row: Result (Col 4 / Dialog) - MATCH WIDTH */}
                    <div className="col-start-4 row-start-1 bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800">
                        <div className="p-4">Result Area (1fr)</div>
                    </div>

                    {/* Bottom Row: Vibes Menu (Col 1) */}
                    <div className="col-start-1 row-start-2 rounded-lg overflow-y-auto bg-stone-900/30 border border-stone-800/50">
                        <VibesMenu />
                    </div>

                    {/* Bottom Row: Fields (Span 3: Cols 2, 3, 4) */}
                    <div className="col-span-3 col-start-2 row-start-2 bg-stone-900/50 rounded-lg p-4 overflow-y-auto border border-stone-800/50">
                        <div className="grid grid-cols-3 gap-4 h-full">
                            <div className="flex flex-col gap-3">
                                <div><label>Character</label><input className="w-full bg-stone-800" /></div>
                            </div>
                            <div className="flex flex-col h-full border border-orange-500/50">
                                <label>Action (Span 3 parents)</label>
                                <textarea
                                    className="w-full h-full bg-stone-800 text-xs"
                                    defaultValue={editValues.action}
                                />
                            </div>
                            <div className="flex flex-col gap-3 h-full">
                                <div><label>Dialog</label><textarea className="w-full bg-stone-800" /></div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* === SANDBOXED COMPONENT END === */}
            </div>
        </div>
    );
}
