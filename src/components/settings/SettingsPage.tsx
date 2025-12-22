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
        <div className="flex flex-col h-full bg-stone-950 text-foreground">
            {/* Theme Bar */}
            <div className="flex items-center justify-between px-6 border-b border-white/5 h-[53px] shrink-0 bg-stone-900/30">
                <h3 className="text-sm font-semibold text-stone-300">THEME</h3>
                <div className="flex items-center gap-2 p-1 bg-black/40 rounded-full border border-white/5">
                    <button
                        onClick={() => setTheme("light")}
                        className={`p-1.5 rounded-full transition-all ${theme === "light" ? "bg-stone-700 text-white shadow-sm" : "text-stone-500 hover:text-stone-300"}`}
                    >
                        <Sun className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setTheme("dark")}
                        className={`p-1.5 rounded-full transition-all ${theme === "dark" ? "bg-stone-700 text-white shadow-sm" : "text-stone-500 hover:text-stone-300"}`}
                    >
                        <Moon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Prompt Templates Bar */}
            <div className="flex items-center justify-between px-6 border-b border-white/5 h-[53px] shrink-0 bg-stone-900/30 mt-px">
                <h3 className="text-sm font-semibold text-stone-300">PROMPT TEMPLATES</h3>
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
            <div className="flex-1 overflow-hidden p-6 max-w-5xl mx-auto w-full flex flex-col">
                {activeTab === 'video' && (
                    <div className="flex flex-col h-full gap-4">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-semibold text-primary">Video Prompt Template</h3>
                            <p className="text-sm text-stone-500 mb-2">
                                Template for generating <strong>video</strong> generation prompts. Variables like {"{{SERIES_STYLE}}"} will be automatically replaced.
                            </p>
                        </div>
                        <Textarea
                            value={videoPrompt}
                            onChange={(e) => setVideoPrompt(e.target.value)}
                            className="flex-1 font-mono text-xs leading-relaxed bg-stone-900/30 border-stone-800 focus:border-stone-700 min-h-[500px] text-stone-400 p-4 resize-none"
                            placeholder="Enter video prompt template..."
                        />
                    </div>
                )}

                {activeTab === 'image' && (
                    <div className="flex flex-col h-full gap-4">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-semibold text-primary">Image Prompt Template</h3>
                            <p className="text-sm text-stone-500 mb-2">
                                Template for generating <strong>still image</strong> prompts (Flux). Focus on visual description.
                            </p>
                        </div>
                        <Textarea
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            className="flex-1 font-mono text-xs leading-relaxed bg-stone-900/30 border-stone-800 focus:border-stone-700 min-h-[500px] text-stone-400 p-4 resize-none"
                            placeholder="Enter image prompt template..."
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
