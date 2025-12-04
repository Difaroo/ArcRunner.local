import { useState, useEffect } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_EPISODE_PROMPT } from "@/lib/defaults"
import { useTheme } from "@/components/theme-provider"
import { Sun, Moon } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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



    return (
        <div className="flex flex-col h-full bg-background text-foreground">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
                <div className="flex items-center gap-4">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground">
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Go back</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <h1 className="text-lg font-semibold">Settings</h1>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground font-light tracking-wider mr-2">THEME</span>
                    <div className="flex items-center p-1 bg-secondary/50 rounded-full border border-border">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setTheme("light")}
                                        className={`p-1.5 rounded-full transition-all ${theme === "light" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        <Sun className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Light Mode</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setTheme("dark")}
                                        className={`p-1.5 rounded-full transition-all ${theme === "dark" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        <Moon className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Dark Mode</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full">
                <div className="flex flex-col gap-4 h-full">
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-lg font-medium text-foreground">Episode Prompt Template</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    This is the master template used to generate prompts for each episode.
                                    Variables like <code>{`{{SERIES_TITLE}}`}</code>, <code>{`{{SERIES_STYLE}}`}</code>, and <code>{`{{LIBRARY_KEYS}}`}</code> will be automatically replaced.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-8 text-xs px-3">
                                            {isSaved ? "Saved!" : "Save Changes"}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Save Changes?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to save changes? This will overwrite the master prompt template.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleSave}>Save</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
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
