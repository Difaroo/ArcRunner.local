import { useState, useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Plus } from "lucide-react"

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
import { DEFAULT_VIDEO_PROMPT, DEFAULT_IMAGE_PROMPT } from "@/lib/defaults"

import { GlobalVibeManager, GlobalVibeManagerHandle } from "./GlobalVibeManager"

interface SettingsPageProps {
    onBack: () => void
}

export function SettingsPage({ onBack }: SettingsPageProps) {
    const [videoPrompt, setVideoPrompt] = useState("")
    const [imagePrompt, setImagePrompt] = useState("")
    const [isSaved, setIsSaved] = useState(false)
    const [activeTab, setActiveTab] = useState<'video' | 'image' | 'camera' | 'movement'>('video')

    const cameraManagerRef = useRef<GlobalVibeManagerHandle>(null);
    const movementManagerRef = useRef<GlobalVibeManagerHandle>(null);

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
            {/* Prompt Templates Bar */}
            <div className="flex items-center justify-between px-6 border-b border-white/5 h-[53px] shrink-0 bg-stone-900/30">
                <h3 className="text-sm font-semibold">Settings & Catalogs</h3>
                <div className="flex h-full items-center gap-6">
                    <div className="flex h-full bg-transparent p-0 gap-6 -mb-[1px]">
                        <button
                            onClick={() => setActiveTab('video')}
                            className={`nav-tab h-full rounded-none ${activeTab === 'video' ? 'active' : ''}`}
                        >
                            Video Prompt
                        </button>
                        <button
                            onClick={() => setActiveTab('image')}
                            className={`nav-tab h-full rounded-none ${activeTab === 'image' ? 'active' : ''}`}
                        >
                            Image Prompt
                        </button>
                        <button
                            onClick={() => setActiveTab('camera')}
                            className={`nav-tab h-full rounded-none ${activeTab === 'camera' ? 'active' : ''}`}
                        >
                            Cameras
                        </button>
                        <button
                            onClick={() => setActiveTab('movement')}
                            className={`nav-tab h-full rounded-none ${activeTab === 'movement' ? 'active' : ''}`}
                        >
                            Movement
                        </button>
                    </div>

                    <div className="h-4 w-px bg-white/10 mx-2"></div>

                    <div className="flex gap-2">
                        {(activeTab === 'video' || activeTab === 'image') && (
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
                        )}
                        {activeTab === 'camera' && (
                            <Button
                                variant="outline-primary"
                                className="h-8 text-xs font-semibold gap-2"
                                onClick={() => cameraManagerRef.current?.openCreateModal()}
                            >
                                <Plus className="w-3 h-3" /> Add Camera
                            </Button>
                        )}
                        {activeTab === 'movement' && (
                            <Button
                                variant="outline-primary"
                                className="h-8 text-xs font-semibold gap-2"
                                onClick={() => movementManagerRef.current?.openCreateModal()}
                            >
                                <Plus className="w-3 h-3" /> Add Movement
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden p-6 max-w-5xl mx-auto w-full flex flex-col">
                {activeTab === 'video' && (
                    <div className="flex flex-col h-full gap-4">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-semibold">Video Prompt Template</h3>
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
                            <h3 className="text-lg font-semibold">Image Prompt Template</h3>
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

                {activeTab === 'camera' && (
                    <GlobalVibeManager ref={cameraManagerRef} type="CAMERA" />
                )}

                {activeTab === 'movement' && (
                    <GlobalVibeManager ref={movementManagerRef} type="MOVEMENT" />
                )}
            </div>

            {/* Database Admin Banner */}
            {(activeTab === 'video' || activeTab === 'image') && (
                <div className="px-6 pb-6 max-w-5xl mx-auto w-full mt-6">
                    <div className="border border-orange-500/50 bg-orange-600 rounded-lg px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <h4 className="text-sm font-normal text-black">Database Admin</h4>
                                <p className="text-xs text-black/70">Open Prisma Studio to inspect and manage the database directly</p>
                            </div>
                            <Button
                                onClick={() => window.open('http://localhost:5555', '_blank')}
                                variant="outline"
                                size="sm"
                                className="bg-transparent border-2 border-black text-black hover:bg-black hover:text-white font-semibold transition-colors"
                            >
                                Open Prisma Studio
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
