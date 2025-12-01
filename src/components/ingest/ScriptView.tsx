import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/PageHeader"

interface ScriptViewProps {
    episodeId: string
    onIngest: (json: string) => Promise<void>
}

export function ScriptView({ episodeId, onIngest }: ScriptViewProps) {
    const [jsonInput, setJsonInput] = useState("")
    const [isIngesting, setIsIngesting] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
            await onIngest(jsonInput)
            setJsonInput("") // Clear on success
        } catch (err: any) {
            setError("Invalid JSON format: " + err.message)
        } finally {
            setIsIngesting(false)
        }
    }

    return (
        <div className="flex flex-col h-full">
            <PageHeader title="Script [JSON]" className="border-t-0 border-b border-white/5" />

            <div className="flex-1 p-6 flex flex-col gap-4">
                <div className="bg-stone-900/50 p-4 rounded-lg border border-white/5 flex-1 flex flex-col">
                    <div className="mb-4 text-sm text-stone-400">
                        Paste your script JSON below.
                    </div>

                    <Textarea
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        placeholder='{ "clips": [ ... ], "library": [ ... ] }'
                        className="flex-1 font-mono text-xs bg-black/50 border-stone-800 text-stone-300 resize-none p-4"
                    />

                    {error && (
                        <div className="mt-4 text-red-500 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined !text-sm">error</span>
                            {error}
                        </div>
                    )}

                    <div className="mt-4 flex justify-end">
                        <Button
                            onClick={handleIngest}
                            disabled={isIngesting}
                            className="bg-primary hover:bg-primary/90 text-white"
                        >
                            {isIngesting ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin mr-2 !text-sm">sync</span>
                                    Ingesting...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined mr-2 !text-sm">input</span>
                                    Ingest Script
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
