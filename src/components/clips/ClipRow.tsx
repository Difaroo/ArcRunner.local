import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Clip } from "@/types"
import { useState, useRef, useEffect } from 'react'
import { parseStringList, joinStringList } from '@/lib/utils/string-helpers'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"
import { ImageUploadCell } from "@/components/ui/ImageUploadCell"
import { EditableCell } from "@/components/ui/EditableCell"
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { MediaDisplay } from "@/components/media/MediaDisplay"
import { RowActions } from "@/components/ui/RowActions"
import { downloadFile, getClipFilename, getNextStatus } from "@/lib/download-utils"
import { useClickOutside } from "@/hooks/useClickOutside"
import { useRowShortcuts } from "@/hooks/useRowShortcuts"
import { useMediaPersistence } from "@/hooks/useMediaPersistence"
import { getComputedClipStatus } from "@/lib/clip-status"
import React from "react"
import { resolveManifest, LibraryContext } from '@/lib/structural-manifest'
import { getModelConfig } from "@/lib/models"
import { ClipRowEditCells } from './ClipRowEditCells'
import { ClipRowDisplayCells } from './ClipRowDisplayCells'

interface ClipRowProps {
    clip: Clip
    isSelected: boolean
    isEditing: boolean
    onSelect: (id: string) => void
    onEdit: (clip: Clip) => void
    onSave: (id: string, values: Partial<Clip>) => void | Promise<void>
    onCancelEdit: () => void
    onGenerate: (clip: Clip) => void
    onPlay: (url: string, contextPlaylist?: any[]) => void
    saving: boolean
    uniqueValues: {
        characters: string[]
        locations: string[]
        styles: string[]
        cameras: string[]
    }
    onDelete: (id: string) => void
    onDuplicate: (id: string) => void
    onResolveImage?: (name: string) => string | undefined
    onStudioAssetClick?: (name: string, type: 'CHARACTER' | 'LOCATION') => void
    onAddReference?: (clipId: string, url: string, type: 'IMAGE' | 'VIDEO') => Promise<void>
    seriesTitle: string
    activeModel?: string // Episode-level model for live icon updates
    onOpenBEM?: (clipId: string) => void // Open BEM for this specific clip
}

export function ClipRow({
    clip,
    isSelected,
    isEditing,
    onSelect,
    onEdit,
    onSave,
    onCancelEdit,
    onGenerate,
    onPlay,
    saving,
    uniqueValues,
    onDelete,
    onDuplicate,
    onResolveImage,
    onStudioAssetClick,
    onAddReference,
    seriesTitle,
    activeModel,
    onOpenBEM
}: ClipRowProps) {
    const [editValues, setEditValues] = useState<Partial<Clip>>({})
    const [downloadCount, setDownloadCount] = useState(0)
    const [showEditGuard, setShowEditGuard] = useState(false)
    const [autoOpenUpload, setAutoOpenUpload] = useState(false);
    const [isRefDragOver, setIsRefDragOver] = useState(false);

    // Structural State
    const derivedStatus = getComputedClipStatus(clip);

    // Helper: resolve URL from a ModelInputSlot record
    const getMISSlotUrl = (slot: any): string => {
        if (slot.media) return slot.media.url || slot.media.thumbnailPath || '';
        if (slot.studioItem) return slot.studioItem.refImageUrl?.split(',')[0] || slot.studioItem.thumbnailPath?.split(',')[0] || '';
        return '';
    };

    // Helper to filter out auto-resolved images (Char/Loc) from the Explicit list
    // UPDATE v0.33: MIS is the single source of truth
    const getCleanExplicitRefs = () => {
        const slots = clip.modelInputSlots || [];
        return slots.map(getMISSlotUrl).filter(Boolean);
    };

    // Optimistic UI for References
    const [optimisticRefs, setOptimisticRefs] = useState<string[] | null>(null);

    // Sync Optimistic State with Props when they update (e.g. after successful save)
    useEffect(() => {
        setOptimisticRefs(null);
    }, [clip.modelInputSlots]);

    // Helper to get current refs (Optimistic > Explicit > Legacy)
    // We only use Optimistic if it's not null.
    const getEffectiveRefs = () => {
        if (optimisticRefs !== null) return optimisticRefs;
        return getCleanExplicitRefs();
    }

    // --- DRAG & DROP HANDLERS (Display Mode) ---
    const handleRefDropRef = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsRefDragOver(false);

        const droppedUrl = e.dataTransfer.getData('text/plain');
        if (droppedUrl) {
            const currentUrls = getEffectiveRefs();
            if (!currentUrls.includes(droppedUrl)) {
                console.log('Dropped on Display Row:', droppedUrl);
                // CHANGE: Prepend for Newest-First (LIFO)
                const newUrls = [droppedUrl, ...currentUrls];
                const newUrlsStr = joinStringList(newUrls);

                // 1. Optimistic Update (Local UI)
                setOptimisticRefs(newUrls);

                // 2. Persist using Relation API (New Architecture)
                try {
                    if (onAddReference) {
                        const isVideo = droppedUrl.match(/\.(mp4|mov|webm|mkv)($|\?)/i);
                        await onAddReference(clip.id, droppedUrl, isVideo ? 'VIDEO' : 'IMAGE');
                    } else {
                        console.warn("onAddReference prop missing");
                    }
                } catch (err) {
                    console.error("Add Reference Failed", err);
                    setOptimisticRefs(null); // Revert
                    alert("Failed to add reference. Please try again.");
                }
            }
        }
    };

    // --- UNLINK HANDLER ---
    const handleRefUnlink = async (url: string, contextId?: string, isResult?: boolean) => {
        try {
            console.log(`[ClipRow] Unlinking ${url} from Clip ${clip.id}`);

            // 1. Optimistic Update
            setOptimisticRefs(prev => {
                const current = prev || getCleanExplicitRefs();
                return current.filter(u => u !== url);
            });

            // 2. Delete ModelInputSlot that matches this URL
            const slots = clip.modelInputSlots || [];
            const matchingSlot = slots.find((s: any) => getMISSlotUrl(s) === url);
            if (matchingSlot) {
                await fetch('/api/media/unlink', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url,
                        clipId: contextId || clip.id,
                        isResult: !!isResult,
                        modelInputSlotId: matchingSlot.id
                    })
                });
            } else {
                // Fallback: legacy unlink
                await fetch('/api/media/unlink', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url,
                        clipId: contextId || clip.id,
                        isResult: !!isResult
                    })
                });
            }

        } catch (e) {
            console.error("Unlink error:", e);
            setOptimisticRefs(null); // Revert
            alert("Failed to unlink image.");
        }
    };

    // --- Model Input Slots Manifest Resolution ---
    const explicitRefsForManifest = getEffectiveRefs().map((url, i) => ({
        id: `ref-${i}`,
        url,
        episodeId: clip.episodeId || '',
        type: (url.match(/\.(mp4|mov|webm|mkv)($|\?)/i) ? 'VIDEO' : 'IMAGE') as any,
        ownerIds: [],
        refImageSort: getEffectiveRefs().length - i // Descending priority matches legacy behavior
    } as any));

    // STRICT MANIFEST RESOLUTION: We only auto-populate exact matches found in the Studio library via onResolveImage
    const resolveStrict = (name: string) => onResolveImage ? onResolveImage(name.trim()) : undefined;

    const locItemUrl = clip.location ? resolveStrict(clip.location) : undefined;
    const locationImages = locItemUrl ? [locItemUrl] : [];

    const charNames = clip.character ? clip.character.split(',') : [];
    const characterImages = charNames.map(resolveStrict).filter((url): url is string => !!url);

    const libraryContext: LibraryContext = {
        styleImage: clip.style ? resolveStrict(clip.style) : undefined,
        characterImages,
        locationImages
    };

    const manifest = resolveManifest(clip, clip.model || 'veo', libraryContext, explicitRefsForManifest);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: clip.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: isDragging ? 'relative' as const : undefined,
    }

    // --- LOCKING LOGIC (Concurrency) ---
    const [clientId, setClientId] = useState<string>('');
    const [lockError, setLockError] = useState<string | null>(null);

    // 1. Initialize Client ID
    useEffect(() => {
        let cid = localStorage.getItem('arc_client_id');
        if (!cid) {
            cid = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('arc_client_id', cid);
        }
        setClientId(cid);
    }, []);

    // 2. SAFETY: Release lock on tab close
    // Since locks are now PERMANENT, we must ensure accidental closures don't leave clips locked forever.
    useEffect(() => {
        if (!isEditing || !clientId) return;

        const handleBeforeUnload = () => {
            // Use sendBeacon for reliability during unload (fetch may be cancelled)
            const blob = new Blob(
                [JSON.stringify({ action: 'unlock', clipId: clip.id, clientId })],
                { type: 'application/json' }
            );
            navigator.sendBeacon('/api/lock', blob);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isEditing, clientId, clip.id]);

    // 2b. SAFETY: Release lock when editing ends externally (e.g. episode change, parent cancel)
    // or when this ClipRow unmounts while editing (e.g. navigating away).
    const wasEditingRef = useRef(false);
    useEffect(() => {
        if (isEditing) {
            wasEditingRef.current = true;
        } else if (wasEditingRef.current && clientId) {
            // isEditing just went false — release lock
            wasEditingRef.current = false;
            fetch('/api/lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unlock', clipId: clip.id, clientId })
            }).catch(e => console.error('Auto-unlock on edit end failed:', e));
        }

        // Unmount cleanup: if still editing when component is destroyed, release lock
        return () => {
            if (wasEditingRef.current && clientId) {
                wasEditingRef.current = false;
                const blob = new Blob(
                    [JSON.stringify({ action: 'unlock', clipId: clip.id, clientId })],
                    { type: 'application/json' }
                );
                navigator.sendBeacon('/api/lock', blob);
            }
        };
    }, [isEditing, clientId, clip.id]);

    // 2. Check Lock Status
    // If locked by someone else, we are effectively read-only for editing
    const isLockedByOther = clip.lockedBy && clip.lockedBy !== clientId;

    const acquireLock = async () => {
        if (!clientId) return false;
        try {
            const res = await fetch('/api/lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'lock', clipId: clip.id, clientId })
            });
            const data = await res.json();
            if (!res.ok) {
                setLockError(`Locked by ${data.lockedBy || 'another user'}`);
                return false;
            }
            return true;
        } catch (e) {
            console.error("Lock failed", e);
            return false; // Fail safe
        }
    };

    const releaseLock = async () => {
        if (!clientId) return;
        try {
            await fetch('/api/lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unlock', clipId: clip.id, clientId })
            });
        } catch (e) { console.error("Unlock failed", e); }
    };

    const handleStartEdit = async () => {
        // Prevent edit if locked
        if (isLockedByOther) {
            alert(`This clip is currently being edited by another user (ID: ${clip.lockedBy}).`);
            return;
        }

        // Try to acquire lock
        const locked = await acquireLock();
        if (locked) {
            startEditing();
        } else {
            alert("Could not acquire lock. Someone else may have just started editing.");
        }
    }

    const startEditing = () => {
        // IMPORTANT: Initialize editValues with explicit keys to ensure tracking works
        // We do NOT filter here, to prevent data loss. Filtering is visual only (View mode).

        setEditValues({
            ...clip,
            negativePrompt: clip.negativePrompt || '',
            location: clip.location || '',
            character: clip.character || '',
            action: clip.action || '',
            dialog: clip.dialog || '',
            camera: clip.camera || '',
            style: clip.style || ''
        })
        onEdit(clip)
    }

    const handleCancelEdit = async () => {
        await releaseLock();
        onCancelEdit();
    }

    const handleSaveAndDownload = () => {
        // Release Lock on complete
        releaseLock();

        // FALCON FIX (Cleanup): Use Relational Data exclusively for History
        // We prefer `mediaResults` (Array of Objects) over `resultUrl` (String/CSV)

        // Helper: Extract filename from URL for fallback
        const getFilename = (url: string) => url.split('/').pop()?.split('?')[0] || 'Unknown';

        // 1. Get History from Relations -> Rich Objects
        const resultHistory = clip.mediaResults && clip.mediaResults.length > 0
            ? clip.mediaResults.map(m => ({
                id: m.id,
                url: m.url,
                type: (m.type === 'VIDEO' || m.url.endsWith('.mp4')) ? 'video' : 'image', // Robust type check
                // TITLE LOGIC: Scene + Title (e.g. "1.1 Intro")
                title: `${clip.scene || ''} ${clip.title || 'Untitled'}`.trim(),
                isReference: false,
                ownerClipId: clip.id,
                episodeId: clip.episodeId || (clip.episode as any)?.id, // Fix: Cast for TS
                isPersisted: clip.isPersisted, // Added for UI Feedback
                deleteIcon: 'minus' as const // Allow clearing results
            }))
            : (clip.resultUrl ? [{
                id: 'legacy-result',
                url: clip.resultUrl,
                type: 'video',
                title: `${clip.scene || ''} ${clip.title || 'Untitled'}`.trim(),
                isReference: false,
                ownerClipId: clip.id,
                episodeId: clip.episodeId || (clip.episode as any)?.id, // Fix: Cast for TS
                isPersisted: clip.isPersisted, // Added for UI Feedback
                deleteIcon: 'minus' as const
            }] : []);

        // 2. Get References from Relations -> Rich Objects
        const referenceParams = clip.mediaReferences && clip.mediaReferences.length > 0
            ? clip.mediaReferences.map(m => ({
                id: m.id,
                url: m.url,
                type: (m.type === 'VIDEO' || m.url.endsWith('.mp4')) ? 'video' : 'image',
                // TITLE LOGIC: Studio Name OR Filename
                title: m.studioItem?.name || getFilename(m.url),
                isReference: true,
                ownerClipId: clip.id,
                episodeId: clip.episode || clip.episodeId // Added for Persistence (matches Clip)
            }))
            : [];

        if (resultHistory.length > 0) {
            // Combine: [Latest Result, Older Results...] + [Effective References...]
            // Note: `resultHistory` should already be sorted Newest -> Oldest
            // @ts-ignore - Types compatibility checked (UniversalMediaItem)
            const fullPlaylist = [...resultHistory, ...referenceParams];

            // Play using the FIRST result (Latest) as start
            onPlay(resultHistory[0].url, fullPlaylist);
            setDownloadCount(prev => prev + 1)
            onSave(clip.id, { status: 'Saved' })
        }
        setShowEditGuard(false)
    }

    const handleDiscardAndEdit = () => {
        setShowEditGuard(false)
        startEditing()
    }

    // --- CLICK OUTSIDE TO CANCEL ---
    // User requested removal of Click Outside logic in favor of shortcuts (Cmd+.)
    // to prevent accidental closing when interacting with complex menus.
    // Explicit 'onCancel' or 'Cmd+.' should be used.

    // We retain setNodeRef for dnd-kit but remove the custom domRef logic.
    // --- CLICK OUTSIDE TO CANCEL ---
    // User requested removal of Click Outside logic in favor of shortcuts (Cmd+.)
    // to prevent accidental closing when interacting with complex menus.
    // Explicit 'onCancel' or 'Cmd+.' should be used.

    // We retain setNodeRef for dnd-kit from top of function.

    // We can just use setNodeRef directly on the TableRow now. 

    // We can just use setNodeRef directly on the TableRow now.


    // --- DELETE LOGIC ---
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const handleDeleteClick = () => {
        setShowDeleteDialog(true);
    };

    const confirmDelete = async () => {
        try {
            const res = await fetch('/api/clips', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: clip.id })
            });

            if (!res.ok) throw new Error('Failed to delete');

            // Notify Parent to remove from list (Needs a new prop or just refresh?)
            // Parent ClipTable uses clips state. It needs to know.
            // We probably need an onDelete prop passed down from Page -> Table -> Row.
            // Or trigger a refresh.
            // Let's call a prop.
            if (onDelete) onDelete(clip.id);

        } catch (e) {
            console.error('Delete failed', e);
            alert('Failed to delete clip');
        } finally {
            setShowDeleteDialog(false);
        }
    };


    const [isPersisted, setIsPersisted] = useState(clip.isPersisted || false);
    const { persistMedia, isPersisting } = useMediaPersistence();






    const handleSave = () => {
        const updates: Partial<Clip> = {};
        const normalize = (val: any) => val === undefined || val === null ? '' : String(val);

        // STRICT WHITELIST: Only allow editing fields that are exposed in the UI.
        // This prevents accidental overwrite of system fields (resultUrl, status) via stale local state.
        const ALLOWED_FIELDS: Array<keyof Clip> = [
            'title',
            'action',
            'negativePrompt',
            'dialog',
            'episode',
            'character',
            'location',
            'camera',
            'style',
            'scene',
        ];

        (Object.keys(editValues) as Array<keyof Clip>).forEach(key => {
            if (!ALLOWED_FIELDS.includes(key)) return;

            const currentVal = editValues[key];
            let originalVal = clip[key];

            if (normalize(currentVal) !== normalize(originalVal)) {
                // @ts-ignore
                updates[key] = currentVal;
            }
        });

        if (Object.keys(updates).length > 0) {
            // Optimistic Release? No, wait for API or fire-and-forget
            releaseLock();
            onSave(clip.id, updates);
        } else {
            handleCancelEdit(); // Use the lock-aware cancel
        }
    }

    const handleDownload = async () => {
        // UNIFIED: Use Persistence for Videos, Download for Images
        if (clip.resultUrl) {
            const cleanUrl = clip.resultUrl.split(',')[0].trim();
            const isVideo = cleanUrl.match(/\.(mp4|mov|webm|mkv)($|\?)/i);

            if (isVideo) {
                const epId = clip.episodeId || clip.episode; // Type safety
                if (epId) {
                    const result = await persistMedia({ clipId: clip.id, episodeId: epId });
                    if (result.success) {
                        setIsPersisted(true);
                        // User explicitly requested status turns to 'empty' upon download/persistence
                        onSave(clip.id, { status: '' });
                    }
                    return;
                }
            }

            // Fallback: Browser Download (Images or Missing Context)
            const filename = getClipFilename(clip, seriesTitle);
            const success = await downloadFile(clip.resultUrl, filename);

            if (success) {
                setDownloadCount(prev => prev + 1)
                // User explicitly requested status turns to 'empty' upon download/persistence
                onSave(clip.id, { status: '' })
            }
        }
    }

    const handleChange = (field: keyof Clip, value: string) => {
        setEditValues(prev => ({ ...prev, [field]: value }))
    }

    const toggleCharacter = (char: string) => {
        const current = parseStringList(editValues.character || "");
        let next: string[];
        if (current.includes(char)) {
            next = current.filter(c => c !== char);
        } else {
            next = [...current, char];
        }
        handleChange('character', next.join(', '));
    }

    useRowShortcuts({
        isEditing,
        isSelected,
        onSave: handleSave,
        onDuplicate: () => onDuplicate(clip.id),
        onDelete: handleDeleteClick,
        onCancel: handleCancelEdit, // Use lock-aware handler
        onDownload: handleDownload
    });

    const rowStatusBorder = derivedStatus.colorClass.includes('red') ? 'border-red-500 bg-red-500/10' :
        derivedStatus.colorClass.includes('green') ? 'border-green-500 bg-green-500/10' :
            derivedStatus.colorClass.includes('orange') ? 'border-orange-500 bg-orange-500/10' :
                'border-stone-600 bg-stone-800/10';

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={`group hover:bg-black transition-colors ${isSelected ? 'bg-stone-900' : ''} ${isEditing ? 'bg-black' : ''} ${isDragging ? 'opacity-50 bg-stone-800' : ''}`}
            data-testid="clip-row"
        >
            <TableCell className={`w-[10px] py-[1px] px-0 text-center align-middle relative cursor-grab active:cursor-grabbing touch-none border-l-[3px] ${rowStatusBorder}`} {...attributes} {...listeners}>
                <TooltipProvider>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <div className="flex items-center justify-center h-full min-h-[46px] w-full py-3">
                                <span className={`material-symbols-outlined !text-base leading-none transition-colors ${derivedStatus.colorClass.includes('red') ? 'text-red-500' : derivedStatus.colorClass.includes('orange') ? 'text-orange-500' : derivedStatus.colorClass.includes('green') ? 'text-green-500' : 'text-stone-600 group-hover:text-stone-400'}`}>drag_indicator</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-stone-900 border-stone-800 text-stone-200">
                            <p className="text-xs">{
                                derivedStatus.state === 'Ready' ? 'Render' :
                                    derivedStatus.state === 'Generating' || derivedStatus.state === 'Done' ? 'Download' :
                                        derivedStatus.state === 'Complete' ? 'Complete' :
                                            derivedStatus.isError ? 'Error' : 'Review'
                            }</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
            <TableCell className="w-[28px] px-0 text-center align-top py-3">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelect(clip.id)}
                />
            </TableCell>
            {isEditing ? (
                <ClipRowEditCells
                    clip={clip}
                    editValues={editValues}
                    handleChange={handleChange}
                    uniqueValues={uniqueValues}
                    toggleCharacter={toggleCharacter}
                    onResolveImage={onResolveImage}
                    onStudioAssetClick={onStudioAssetClick}
                    getEffectiveRefs={getEffectiveRefs}
                    onAddReference={onAddReference}
                    handleRefUnlink={handleRefUnlink}
                    autoOpenUpload={autoOpenUpload}
                    setAutoOpenUpload={setAutoOpenUpload}
                    handleStartEdit={handleStartEdit}
                />
            ) : (
                <ClipRowDisplayCells
                    clip={clip}
                    handleStartEdit={handleStartEdit}
                    onResolveImage={onResolveImage}
                    onStudioAssetClick={onStudioAssetClick}
                    getEffectiveRefs={getEffectiveRefs}
                    isRefDragOver={isRefDragOver}
                    setIsRefDragOver={setIsRefDragOver}
                    handleRefDropRef={handleRefDropRef}
                    handleRefUnlink={handleRefUnlink}
                    onPlay={onPlay}
                />
            )}

            {/* --- REFACTOR START: SHARED COMPONENTS --- */}

            < TableCell className="align-top py-3 w-[80px] text-left" >
                {/* RESULT Column using MediaDisplay */}
                {
                    derivedStatus.state === 'Generating' ? (
                        <div className="flex items-center justify-center w-[70px] h-[70px] bg-stone-900 border border-stone-800 rounded-md">
                            <Loader2 className="h-6 w-6 text-primary animate-spin" />
                        </div>
                    ) : (clip.resultUrl) && (
                        <div className={`flex justify-start relative ${derivedStatus.isError ? 'opacity-50 grayscale border-red-500 border-2 rounded-md' : ''}`}>
                            {/* Visual Warning for Stale/Error State */}
                            {derivedStatus.isError && (
                                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                    <span className="material-symbols-outlined text-red-500 bg-black/50 rounded-full p-1">warning</span>
                                </div>
                            )}
                            <MediaDisplay
                                // Safe URL Extraction: Use ParseStringList[0]
                                url={clip.thumbnailPath || parseStringList(clip.resultUrl)[0]}
                                originalUrl={parseStringList(clip.resultUrl)[0]}
                                model={clip.model}
                                title={getClipFilename(clip, seriesTitle).replace(/\.[^/.]+$/, "")}
                                action={clip.action || undefined}
                                description={clip.dialog || undefined}
                                isThumbnail={!!clip.thumbnailPath}
                                contentType={
                                    (() => {
                                        const urls = parseStringList(clip.resultUrl || '');
                                        const primaryUrl = urls[0] || '';
                                        const isVideoExt = primaryUrl.match(/\.(mp4|mov|webm|mkv)($|\?)/i);
                                        const isVideoModel = (clip.model?.toLowerCase().includes('veo') || clip.model?.toLowerCase().includes('kling') || clip.model?.toLowerCase().includes('minimax') || clip.model?.toLowerCase().includes('luma'));

                                        if (primaryUrl.match(/\.(png|jpg|jpeg|webp)($|\?)/i)) return 'image';
                                        return (isVideoExt || isVideoModel) ? 'video' : 'image';
                                    })()
                                }
                                onPlay={(url) => {
                                    // RESTORED: Include Characters and Locations in Playlist as rich objects
                                    const explicitRefs = getCleanExplicitRefs();
                                    const charImages = clip.characterImageUrls || [];
                                    const locImages = clip.locationImageUrls || [];
                                    const stringRefs = [...explicitRefs, ...charImages, ...locImages].filter(Boolean);

                                    const refItems = stringRefs.map((u: string, idx: number) => ({
                                        id: u,
                                        url: u,
                                        type: (u.match(/\.(mp4|mov|webm|mkv)($|\?)/i) ? 'video' : 'image') as 'video' | 'image',
                                        title: charImages.includes(u) ? 'Character Reference' : locImages.includes(u) ? 'Location Reference' : 'Reference',
                                        isReference: true,
                                        ownerClipId: clip.id.toString()
                                    }));

                                    const isVideoModel = (clip.model?.toLowerCase().includes('veo') || clip.model?.toLowerCase().includes('kling') || clip.model?.toLowerCase().includes('minimax') || clip.model?.toLowerCase().includes('luma'));
                                    const resultIsVideo = isVideoModel || !!url.match(/\.(mp4|mov|webm|mkv)($|\?)/i);

                                    const resultItems = [{
                                        id: `result-${clip.id}-primary`,
                                        url: url,
                                        type: (resultIsVideo ? 'video' : 'image') as 'video' | 'image',
                                        title: getClipFilename(clip, seriesTitle).replace(/\.[^/.]+$/, ""),
                                        isReference: false,
                                        ownerClipId: clip.id.toString()
                                    }];

                                    const fullPlaylist = [...resultItems, ...refItems];
                                    onPlay(url, fullPlaylist);
                                }}
                                className="w-[70px] max-h-[70px] aspect-square object-cover rounded-md overflow-hidden border border-stone-800 shadow-sm"
                                onUseAsRef={(url) => {
                                    if (onAddReference) {
                                        onAddReference(clip.id, url, 'IMAGE');
                                    }
                                }}
                                episodeId={clip.episodeId || clip.episode} // Pass Persistence Context
                                ownerClipId={clip.id} // Pass Clip ID for Persistence
                                isPersisted={isPersisted} // NEW: Ensure UVM has matching feedback state
                                onUpdate={async (id, updates) => {
                                    if (updates && updates.isPersisted !== undefined) {
                                        setIsPersisted(updates.isPersisted);
                                    }
                                    if (updates) {
                                        const dbUpdates: any = {};
                                        if (updates.status !== undefined) dbUpdates.status = updates.status;
                                        if (updates.action !== undefined) dbUpdates.action = updates.action;
                                        if (updates.description !== undefined) dbUpdates.dialog = updates.description; // UVM uses 'description' for 'dialog'

                                        if (Object.keys(dbUpdates).length > 0) {
                                            onSave(clip.id, dbUpdates);
                                        }
                                    }
                                }}
                            />
                        </div>
                    )
                }
            </TableCell >

            <TableCell className="align-top text-left py-3 w-[40px] px-1">
                {/* ACTION Column using RowActions */}
                <RowActions
                    status={derivedStatus.label}
                    resultUrl={clip.resultUrl}
                    isEditing={isEditing}
                    isSaving={saving}
                    onEditStart={() => { }} // Not used explicitly for start, as start is implicit click
                    onEditSave={handleSave}
                    onEditCancel={onCancelEdit}
                    onGenerate={() => onGenerate(clip)}
                    onDownload={handleDownload}
                    onDelete={handleDeleteClick}
                    onDuplicate={() => onDuplicate(clip.id)}
                    className="items-center"
                    data-testid="row-actions"
                    isPersisted={isPersisted}
                    isImageModel={getModelConfig(activeModel || clip.model || '').isImage}
                    onOpenBEM={onOpenBEM ? () => onOpenBEM(clip.id) : undefined}
                />
            </TableCell>

            {/* --- REFACTOR END --- */}

            <AlertDialog open={showEditGuard} onOpenChange={setShowEditGuard}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unsaved Clip</AlertDialogTitle>
                        <AlertDialogDescription>
                            This clip has not been saved. Save now, or discard the clip?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleDiscardAndEdit}>Discard</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSaveAndDownload}>Save</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="border-destructive/50 bg-stone-900 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Clip?</AlertDialogTitle>
                        <AlertDialogDescription className="text-stone-400">
                            Are you sure you want to delete this clip? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row items-center justify-end gap-2">
                        <Button variant="ghost" onClick={confirmDelete} className="text-stone-400 hover:text-destructive hover:bg-destructive/10">Delete</Button>
                        <Button variant="default" onClick={() => setShowDeleteDialog(false)} className="bg-white text-black hover:bg-stone-200">Cancel</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </TableRow >
    )
}

