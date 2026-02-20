
import os

file_path = "/Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/src/components/clips/BatchEditModalV2.tsx"

new_content = """            {/* TOP ROW: Holistic Dashboard (Assets & Result) */}
            <div className="flex-[3] flex gap-4 min-h-0 border-b border-stone-800/50 pb-4">
                
                {/* 1. Asset Pool (Left Column - Vertical) */}
                <div className="flex-1 bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800">
                     <div className="px-3 py-2 border-b border-stone-800 bg-stone-900/80">
                        <h3 className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Asset Pool</h3>
                    </div>
                    <ClipAssetScroller 
                        mediaItems={mediaItems}
                        onSelect={handleAddToSlot}
                        isLoading={false}
                        orientation="vertical"
                        className="flex-1 w-full"
                    />
                </div>

                {/* 2. Middle Column: Slots (Horizontal) */}
                <div className="flex-[2.5] bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800">
                      <div className="px-3 py-2 border-b border-stone-800 bg-stone-900/80">
                            <h3 className="text-xs text-amber-500 uppercase tracking-wider font-semibold">Generation Inputs</h3>
                        </div>
                         <ModelInputSlots
                            modelConfig={getModelConfig(clip.model || 'veo-fast')}
                            mediaItems={mediaItems}
                            onRemove={handleRemoveFromSlot}
                            orientation="horizontal"
                            className="flex-1 overflow-x-auto p-4 gap-4"
                        />
                </div>

                {/* 3. Right Column: Result */}
                <div className="flex-[1.5] bg-stone-900/50 rounded-lg overflow-hidden flex flex-col border border-stone-800">
                    <div className="px-3 py-2 border-b border-stone-800 bg-stone-900/80">
                        <h3 className="text-xs text-amber-500 uppercase tracking-wider font-semibold">Latest Result</h3>
                    </div>
                    <div className="flex-1 relative bg-black flex items-center justify-center">
                        {clip.resultUrl ? (
                            (clip.resultUrl.includes('.mp4') || clip.resultUrl.includes('.webm')) ? (
                                <video src={clip.resultUrl} controls className="max-w-full max-h-full" />
                            ) : (
                                <img src={clip.resultUrl} alt="Result" className="max-w-full max-h-full object-contain" />
                            )
                        ) : (
                            <span className="text-stone-600 text-xs uppercase tracking-widest">No Generation</span>
                        )}
                    </div>
                </div>
            </div>

"""

try:
    with open(file_path, "r") as f:
        lines = f.readlines()

    start_idx = -1
    end_idx = -1

    for i, line in enumerate(lines):
        if "{/* TOP ROW: Holistic Dashboard (Assets & Result) */}" in line:
            start_idx = i
        if "{/* BOTTOM ROW: Controls & Metadata */}" in line:
            end_idx = i
            break

    if start_idx != -1 and end_idx != -1:
        # Check matching
        print(f"Replacing lines {start_idx} to {end_idx}")
        # Insert blank line before bottom row just in case
        modified_lines = lines[:start_idx] + [new_content + "\n"] + lines[end_idx:]
        
        with open(file_path, "w") as f:
            f.writelines(modified_lines)
        print("Replacement successful")
    else:
        print(f"Could not find markers. Start: {start_idx}, End: {end_idx}")

except Exception as e:
    print(f"Error: {e}")
