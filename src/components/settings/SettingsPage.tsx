import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_EPISODE_PROMPT } from "@/lib/defaults"
import { useTheme } from "@/components/theme-provider"
import { Sun, Moon } from "lucide-react"

interface SettingsPageProps {
    onBack: () => void
}

export function SettingsPage({ onBack }: SettingsPageProps) {
    const [episodePrompt, setEpisodePrompt] = useState("")
    const [isSaved, setIsSaved] = useState(false)
    const { theme, setTheme } = useTheme()

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
        <div className="flex flex-col h-full bg-background text-foreground">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Button>
                    <h1 className="text-lg font-semibold">Settings</h1>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="flex items-center mr-4 border-r border-border pr-4">
                        <div className="flex items-center p-1 bg-secondary/50 rounded-full border border-border">
                            <button
                                onClick={() => setTheme("light")}
                                className={`p-1.5 rounded-full transition-all ${theme === "light" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                title="Light Mode"
                            >
                                <Sun className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setTheme("dark")}
                                className={`p-1.5 rounded-full transition-all ${theme === "dark" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                title="Dark Mode"
                            >
                                <Moon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleReset} className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive">
                        Reset to Default
                    </Button>
                    <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
                        {isSaved ? "Saved!" : "Save Changes"}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full">
                <div className="flex flex-col gap-4 h-full">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-lg font-medium text-foreground">Episode Prompt Template</h2>
                        <p className="text-sm text-muted-foreground">
                            This is the master template used to generate prompts for each episode.
                            Variables like <code>{`{{SERIES_TITLE}}`}</code>, <code>{`{{SERIES_STYLE}}`}</code>, and <code>{`{{LIBRARY_KEYS}}`}</code> will be automatically replaced.
                        </p>
                    </div>

                    <Textarea
                        value={episodePrompt}
                        onChange={(e) => setEpisodePrompt(e.target.value)}
                        className="flex-1 font-mono text-sm bg-card border-input text-foreground resize-none p-6 leading-relaxed min-h-[600px]"
                        spellCheck={false}
                    />
                </div>
            </div>
        </div>
    )
}
