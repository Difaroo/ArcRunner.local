import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/PageHeader"

interface ScriptViewProps {
    episodeId: string
    seriesId: string
    seriesTitle: string
    onIngest: (json: string, defaultModel: string) => Promise<void>
}

export function ScriptView({ episodeId, seriesId, seriesTitle, onIngest }: ScriptViewProps) {
    const [jsonInput, setJsonInput] = useState("")
    const [isIngesting, setIsIngesting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [defaultModel, setDefaultModel] = useState("veo-fast")

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("scriptViewJson")
        if (saved) setJsonInput(saved)
    }, [])

    // Save to localStorage on change
    useEffect(() => {
        localStorage.setItem("scriptViewJson", jsonInput)
    }, [jsonInput])

    const handleIngest = async () => {
        setError(null)
        if (!jsonInput.trim()) {
            setError("Please enter JSON content.")
            return
        }

        try {
            // Basic validation
            JSON.parse(jsonInput)

            setIsIngesting(true)
            await onIngest(jsonInput, defaultModel)
            setJsonInput("") // Clear on success
        } catch (err: any) {
            setError("Invalid JSON format: " + err.message)
        } finally {
            setIsIngesting(false)
        }
    }

    return (
        <div className="flex flex-col h-full p-6 gap-4">
            <div className="flex justify-between items-center text-sm text-stone-400">
                <span>Paste your script JSON below.</span>
            </div>

            <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{ "clips": [ ... ], "library": [ ... ] }'
                className="flex-1 font-mono text-xs bg-black/50 border-stone-800 text-stone-300 resize-none p-4 focus:ring-1 focus:ring-primary/50"
            />

            {error && (
                <div className="text-red-500 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined !text-sm">error</span>
                    {error}
                </div>
            )}

            <div className="bg-stone-900/50 p-2 rounded-lg border border-white/5 flex justify-end items-center gap-4">
                <div className="flex items-center gap-2 px-2">
                    <label className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Default Episode Model:</label>
                    <select
                        value={defaultModel}
                        onChange={(e) => setDefaultModel(e.target.value)}
                        className="bg-transparent border border-stone-700 text-xs text-stone-300 rounded px-2 py-1 outline-none cursor-pointer hover:border-stone-500 transition-colors"
                    >
                        <option value="veo-fast">Veo Fast (Video)</option>
                        <option value="veo-quality">Veo Quality (Video)</option>
                        <option value="flux-pro">Flux Pro (Image)</option>
                        <option value="flux-flex">Flux Flex (Image)</option>
                    </select>
                </div>
                <Button
                    onClick={handleIngest}
                    disabled={isIngesting}
                    className="bg-primary hover:bg-primary/90 text-white h-8 text-xs px-3"
                >
                    {isIngesting ? (
                        <>
                            <span className="material-symbols-outlined animate-spin mr-2 !text-sm">sync</span>
                            Loading...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined mr-2 !text-sm">input</span>
                            Load Studio & Episode Data
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
