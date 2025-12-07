import { useState, useEffect } from "react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip"
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
import { Sun, Moon, ArrowLeft } from "lucide-react"
import { DEFAULT_VIDEO_PROMPT, DEFAULT_IMAGE_PROMPT } from "@/lib/defaults"

interface SettingsPageProps {
    onBack: () => void
}

export function SettingsPage({ onBack }: SettingsPageProps) {
    const [videoPrompt, setVideoPrompt] = useState("")
    const [imagePrompt, setImagePrompt] = useState("")
    const [isSaved, setIsSaved] = useState(false)
    const [activeTab, setActiveTab] = useState<'video' | 'image'>('video')
    const { theme, setTheme } = useTheme()

    useEffect(() => {
        const savedVideo = localStorage.getItem("videoPromptTemplate")
        const savedImage = localStorage.getItem("imagePromptTemplate")
        setVideoPrompt(savedVideo || DEFAULT_VIDEO_PROMPT)
        setImagePrompt(savedImage || DEFAULT_IMAGE_PROMPT)
    }, [])

    const handleSave = () => {
        localStorage.setItem("videoPromptTemplate", videoPrompt)
        localStorage.setItem("imagePromptTemplate", imagePrompt)
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
    }

    return (
        <div className="flex flex-col h-full bg-background text-foreground transition-colors duration-300">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-border bg-card">
                <div className="flex items-center gap-4">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onBack}>
                                    <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Go back</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <div>
                        <h2 className="text-2xl font-bold">Settings</h2>
                        <p className="text-muted-foreground">Manage your application preferences</p>
                    </div>
                </div>

                {/* Theme Toggle */}
                <div className="flex items-center gap-2 p-1 bg-secondary/50 rounded-full border border-border">
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

            <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full flex flex-col">
                {/* Tabs Header */}
                <div className="flex justify-between items-center mb-4 border-b border-white/5 relative h-[53px] shrink-0">
                    <h3 className="text-sm font-semibold text-stone-300">Prompt Templates</h3>

                    <div className="flex h-full items-center gap-6">
                        <div className="flex h-full bg-transparent p-0 gap-6 -mb-[1px]">
                            <button
                                onClick={() => setActiveTab('video')}
                                className={`nav-tab h-full rounded-none ${activeTab === 'video' ? 'active' : ''}`}
                            >
                                Video
                            </button>
                            <button
                                onClick={() => setActiveTab('image')}
                                className={`nav-tab h-full rounded-none ${activeTab === 'image' ? 'active' : ''}`}
                            >
                                Image
                            </button>
                        </div>

                        <div className="h-4 w-px bg-white/10 mx-2"></div>

                        <div className="flex gap-2">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline-primary" className="h-8 text-xs font-semibold">
                                        {isSaved ? "Saved!" : "Save Changes"}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Save Defaults?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will update the default prompt templates for all NEW series. Existing series will not be affected unless you reset them manually.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleSave}>Confirm Save</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === 'video' && (
                        <div className="flex flex-col h-full gap-4">
                            <h3 className="text-lg font-semibold text-primary">Video Prompt Template</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                                Template for generating <strong>video</strong> generation prompts. Variables like {"{{SERIES_STYLE}}"} will be automatically replaced.
                            </p>
                            <Textarea
                                value={videoPrompt}
                                onChange={(e) => setVideoPrompt(e.target.value)}
                                className="flex-1 font-mono text-sm leading-relaxed bg-stone-900/50 border-stone-800 focus:border-stone-700 min-h-[500px]"
                                placeholder="Enter video prompt template..."
                            />
                        </div>
                    )}

                    {activeTab === 'image' && (
                        <div className="flex flex-col h-full gap-4">
                            <h3 className="text-lg font-semibold text-primary">Image Prompt Template</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                                Template for generating <strong>still image</strong> prompts (Flux). Focus on visual description.
                            </p>
                            <Textarea
                                value={imagePrompt}
                                onChange={(e) => setImagePrompt(e.target.value)}
                                className="flex-1 font-mono text-sm leading-relaxed bg-stone-900/50 border-stone-800 focus:border-stone-700 min-h-[500px]"
                                placeholder="Enter image prompt template..."
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
