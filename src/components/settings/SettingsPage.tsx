
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_EPISODE_PROMPT } from "@/lib/defaults"

interface SettingsPageProps {
    onBack: () => void
}

export function SettingsPage({ onBack }: SettingsPageProps) {
    const [episodePrompt, setEpisodePrompt] = useState("")
    const [isSaved, setIsSaved] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem("episodePromptTemplate")
        setEpisodePrompt(saved || DEFAULT_EPISODE_PROMPT)
    }, [])

    const handleSave = () => {
        localStorage.setItem("episodePromptTemplate", episodePrompt)
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
    }

    const handleReset = () => {
        if (confirm("Are you sure you want to reset to the default prompt? This will overwrite your changes.")) {
            setEpisodePrompt(DEFAULT_EPISODE_PROMPT)
            localStorage.setItem("episodePromptTemplate", DEFAULT_EPISODE_PROMPT)
        }
    }

    return (
        <div className="flex flex-col h-full bg-stone-950 text-white">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-stone-900">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} className="text-stone-400 hover:text-white">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Button>
                    <h1 className="text-lg font-semibold">Settings</h1>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReset} className="border-red-900/50 text-red-500 hover:bg-red-900/20 hover:text-red-400">
                        Reset to Default
                    </Button>
                    <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-black font-medium">
                        {isSaved ? "Saved!" : "Save Changes"}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full">
                <div className="flex flex-col gap-4 h-full">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-lg font-medium text-stone-200">Episode Prompt Template</h2>
                        <p className="text-sm text-stone-500">
                            This is the master template used to generate prompts for each episode.
                            Variables like <code>{`{{SERIES_TITLE}}`}</code>, <code>{`{{SERIES_STYLE}}`}</code>, and <code>{`{{LIBRARY_KEYS}}`}</code> will be automatically replaced.
                        </p>
                    </div>

                    <Textarea
                        value={episodePrompt}
                        onChange={(e) => setEpisodePrompt(e.target.value)}
                        className="flex-1 font-mono text-sm bg-stone-900 border-stone-800 text-stone-300 resize-none p-6 leading-relaxed min-h-[600px]"
                        spellCheck={false}
                    />
                </div>
            </div>
        </div>
    )
}
