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
import React from "react"

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
    seriesTitle
}: ClipRowProps) {
    const [editValues, setEditValues] = useState<Partial<Clip>>({})
    const [downloadCount, setDownloadCount] = useState(0)
    const [showEditGuard, setShowEditGuard] = useState(false)
    const [autoOpenUpload, setAutoOpenUpload] = useState(false);
    const [isRefDragOver, setIsRefDragOver] = useState(false);

    // Helper to filter out auto-resolved images (Char/Loc) from the Explicit list
    // UPDATE v0.16.7: Hybrid Approach
    const getCleanExplicitRefs = () => {
        // Phase 4 (STRICT MODE): Use Native Array if available (even if empty)
        // This prevents "Zombie" legacy data from appearing when Media table is empty.
        if (clip.mediaReferences !== undefined && clip.mediaReferences !== null) {
            return clip.mediaReferences.map(m => m.url);
        }

        // Legacy Fallback (Only if mediaReferences is NOT loaded)
        // This path should rarely run if fetch includes relations.
        const hasExplicit = clip.explicitRefUrls !== undefined && clip.explicitRefUrls !== null;

        if (hasExplicit) {
            return parseStringList(clip.explicitRefUrls);
        } else {
            const rawUrls = parseStringList(clip.refImageUrls);
            const autoImages = new Set([
                ...(clip.characterImageUrls || []),
                ...(clip.locationImageUrls || [])
            ]);
            return rawUrls.filter(u => !autoImages.has(u));
        }
    };

    // Optimistic UI for References
    const [optimisticRefs, setOptimisticRefs] = useState<string[] | null>(null);

    // Sync Optimistic State with Props when they update (e.g. after successful save)
    useEffect(() => {
        setOptimisticRefs(null);
    }, [clip.explicitRefUrls, clip.refImageUrls]);

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
                        // Auto-detect type (basic)
                        const isVideo = droppedUrl.match(/\.(mp4|mov|webm|mkv)($|\?)/i);
                        await onAddReference(clip.id, droppedUrl, isVideo ? 'VIDEO' : 'IMAGE');
                    } else {
                        // Fallback (Should not happen if parent implements it)
                        console.warn("onAddReference prop missing, falling back to legacy save");
                        await onSave(clip.id, {
                            explicitRefUrls: newUrlsStr,
                            refImageUrls: newUrlsStr
                        });
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

            // 2. API Call
            const res = await fetch('/api/media/unlink', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    clipId: contextId || clip.id, // Use context if provided (for safety), else self
                    isResult: !!isResult
                })
            });

            if (!res.ok) throw new Error('Unlink failed');

            // 3. Notify Parent (Trigger Save/Refresh to persist DB state to UI)
            // Ideally, we just assume optimistic is enough until next refresh, 
            // but triggering a save guarantees sync if user navigates away.
            // onSave(clip.id, {}); // No-op save to trigger refresh?

        } catch (e) {
            console.error("Unlink error:", e);
            setOptimisticRefs(null); // Revert
            alert("Failed to unlink image.");
        }
    };

    const renderedRefs = [...getEffectiveRefs()]; // FIX: No reverse, backend is Newest First (Desc)

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
            location: clip.location || '', // Robust init to ensure key exists for Object.keys loop
            character: clip.character || '',
            action: clip.action || '',
            dialog: clip.dialog || '',
            camera: clip.camera || '',
            style: clip.style || '',
            refImageUrls: getCleanExplicitRefs().join(',')
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
                deleteIcon: 'minus' as const // Allow clearing results
            }))
            : (clip.resultUrl ? [{
                id: 'legacy-result',
                url: clip.resultUrl,
                type: 'video',
                title: `${clip.scene || ''} ${clip.title || 'Untitled'}`.trim(),
                isReference: false,
                ownerClipId: clip.id,
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
                ownerClipId: clip.id
            }))
            : parseStringList(clip.explicitRefUrls || clip.refImageUrls).map((url, idx) => ({
                id: `legacy-ref-${idx}`,
                url: url,
                type: 'image',
                title: getFilename(url),
                isReference: true,
                ownerClipId: clip.id
            }));

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


    const handleDownload = async () => {
        if (clip.resultUrl) {
            const filename = getClipFilename(clip, seriesTitle);
            const success = await downloadFile(clip.resultUrl, filename);

            if (success) {
                setDownloadCount(prev => prev + 1)
                const newStatus = getNextStatus(clip.status || '');
                onSave(clip.id, { status: newStatus })
            }
        }
    }

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
            'refImageUrls', // Mapped to explicitRefUrls
            'character',
            'location',
            'camera',
            'style',
            'scene', // Fix: Allow Scene updates
            // Add other editable fields here if needed (e.g. shotType).
            // DO NOT INCLUDE: resultUrl, status, taskId.
        ];

        (Object.keys(editValues) as Array<keyof Clip>).forEach(key => {
            if (!ALLOWED_FIELDS.includes(key)) return;

            const currentVal = editValues[key];
            let originalVal;
            // Explicitly map refImageUrls key back to the 'explicitRefUrls' source of truth
            if (key === 'refImageUrls') {
                originalVal = clip.explicitRefUrls || clip.refImageUrls;

                // If Ref Images changed, update both legacy and explicit fields to keep them in sync
                if (String(currentVal) !== String(originalVal)) {
                    updates.explicitRefUrls = String(currentVal);
                    updates.refImageUrls = String(currentVal);
                }
                return;
            } else {
                originalVal = clip[key];
            }

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

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={`group hover:bg-black transition-colors ${isSelected ? 'bg-stone-900' : ''} ${isEditing ? 'bg-black' : ''} ${isDragging ? 'opacity-50 bg-stone-800' : ''}`}
            data-testid="clip-row"
        >
            <TableCell className="w-[10px] p-0 text-center align-top py-3 cursor-grab active:cursor-grabbing touch-none" {...attributes} {...listeners}>
                <div className="flex items-center justify-center h-4 w-4">
                    <span className="material-symbols-outlined text-stone-600 hover:text-stone-400 !text-base leading-none">drag_indicator</span>
                </div>
            </TableCell>
            <TableCell className="w-[28px] px-0 text-center align-top py-3">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelect(clip.id)}
                />
            </TableCell>
            <TableCell className={`align-top font-sans font-extralight text-stone-500 text-xs w-[35px] px-1 py-3`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-stone-500">
                    {isEditing ? (
                        <Input
                            value={editValues.scene || ''}
                            onChange={(e) => handleChange('scene', e.target.value)}
                            className="h-8 w-full text-xs px-1 text-center bg-stone-900 border-stone-700 text-stone-500 font-sans disabled:opacity-50"
                        />
                    ) : (
                        clip.scene
                    )}
                </EditableCell>
            </TableCell>

            {/* ... [Title/Char/Loc/Cam/Action/Dialog Cells Omitted for Brevity - Keeping same Logic] ... 
                Actually, multi_replace_file_content would be better if I could target chunks.
                But since I'm doing a full file replace to ensure imports are clean, I must include EVERYTHING.
                I will copy the standard cells from the view.
            */}

            <TableCell className={`align-top w-[160px] py-3`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="font-medium text-white block">
                    {isEditing ? (
                        <Input
                            value={editValues.title || ''}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className="h-8 w-full text-xs bg-stone-900 border-stone-700 text-white font-normal px-2 placeholder:text-stone-600"
                        />
                    ) : (
                        <span className="text-xs text-white leading-tight font-sans font-medium -translate-y-[5px] inline-block">{clip.title || '+'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top w-[170px] py-3`} data-testid="cell-character">
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white whitespace-pre-line text-xs font-sans font-extralight">
                    {isEditing ? (
                        <div className="w-full">
                            <div className="relative w-full flex items-center gap-1">
                                <Input
                                    value={editValues.character || ''}
                                    onChange={(e) => handleChange('character', e.target.value)}
                                    className="h-full min-h-[32px] w-full text-xs"
                                    placeholder="Characters..."
                                />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                            <span className="material-symbols-outlined !text-sm">expand_more</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56 max-h-60 overflow-y-auto bg-stone-900 border-stone-800 text-white">
                                        {uniqueValues.characters.map((char) => (
                                            <DropdownMenuCheckboxItem
                                                key={char}
                                                checked={parseStringList(editValues.character || "").includes(char)}
                                                onCheckedChange={() => toggleCharacter(char)}
                                                onSelect={(e) => e.preventDefault()}
                                                className="focus:bg-stone-800 focus:text-white"
                                            >
                                                {char}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            {/* Edit Mode Preview - Live Updates using editValues */}
                            {isEditing && onResolveImage ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {(editValues.character ? parseStringList(editValues.character) : []).map((char, i) => {
                                        const url = onResolveImage?.(char);
                                        if (!url) return null;
                                        return (
                                            <img
                                                key={`${char}-${i}`}
                                                src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                                alt={char}
                                                className="w-[40px] h-[40px] object-cover rounded border border-white/10 shadow-sm cursor-pointer hover:opacity-75 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onStudioAssetClick?.(char, 'CHARACTER');
                                                }}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                title={char}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                /* Fallback to existing static Preview if no resolver */
                                clip.characterImageUrls && clip.characterImageUrls.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1 opacity-50">
                                        {clip.characterImageUrls.map((url, i) => (
                                            <img
                                                key={i}
                                                src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                                alt="Char Prev"
                                                className="w-[32px] h-[32px] object-cover rounded border border-white/10 shadow-sm"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-[70px] overflow-hidden">
                            {clip.character
                                ? clip.character.split(',').map((char, i, arr) => (
                                    <div key={i} className="leading-tight truncate" title={char.trim()}>{char.trim()}{i < arr.length - 1 ? ',' : ''}</div>
                                ))
                                : <span className="text-stone-500 italic">+</span>
                            }
                            {clip.characterImageUrls && clip.characterImageUrls.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {clip.characterImageUrls.map((url, i) => {
                                        // Get character name from URL index
                                        const chars = parseStringList(clip.character || "");
                                        const charName = chars[i] || chars[0]; // Fallback to first if index mismatch
                                        return (
                                            <img
                                                key={i}
                                                src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                                alt="Char Ref"
                                                className="w-[40px] h-[40px] object-cover rounded border border-white/10 shadow-sm cursor-pointer hover:opacity-75 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (charName) {
                                                        onStudioAssetClick?.(charName, 'CHARACTER');
                                                    }
                                                }}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                title={charName}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top w-[170px] py-3`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white">
                    {isEditing ? (
                        <div className="w-full">
                            <div className="relative w-full flex items-center gap-1">
                                <Input
                                    value={editValues.location || ''}
                                    onChange={(e) => handleChange('location', e.target.value)}
                                    className="h-8 w-full text-xs"
                                    placeholder="Location..."
                                />
                                {uniqueValues.locations.length > 0 && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                                <span className="material-symbols-outlined !text-sm">expand_more</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-56 max-h-60 overflow-y-auto bg-stone-900 border-stone-800 text-white">
                                            {uniqueValues.locations.map((loc) => (
                                                <DropdownMenuItem
                                                    key={loc}
                                                    onClick={() => handleChange('location', loc)}
                                                    className="focus:bg-stone-800 focus:text-white cursor-pointer"
                                                >
                                                    {loc}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                            {/* Edit Mode Preview - Location Thumb (Live Update) */}
                            {isEditing && onResolveImage && (editValues.location || "").trim().length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {(() => {
                                        const locName = (editValues.location || "").trim();
                                        const url = onResolveImage(locName);
                                        if (!url) return null;
                                        return (
                                            <img
                                                key={locName}
                                                src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                                alt={locName}
                                                className="w-[32px] h-[32px] object-cover rounded border border-white/10 shadow-sm opacity-50"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                title={locName}
                                            />
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-[70px] overflow-hidden">
                            <span className="text-xs text-white leading-tight font-sans font-extralight truncate block" title={clip.location || ''}>{clip.location || '+'}</span>
                            {clip.locationImageUrls && clip.locationImageUrls.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {clip.locationImageUrls.map((url, i) => (
                                        <img
                                            key={i}
                                            src={url.startsWith('/') || url.startsWith('http') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                            alt={"Loc Ref"}
                                            className="w-[40px] h-[40px] object-cover rounded border border-white/10 shadow-sm cursor-pointer hover:opacity-75 transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const locationName = clip.location?.trim();
                                                if (locationName) {
                                                    onStudioAssetClick?.(locationName, 'LOCATION');
                                                }
                                            }}
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top text-white text-xs w-[140px] py-3`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit}>
                    {isEditing ? (
                        <div className="flex flex-col gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs text-left truncate">
                                        {editValues.camera || "Select..."}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto bg-stone-900 border-stone-800 text-white">
                                    {uniqueValues.cameras.map((opt) => (
                                        <DropdownMenuItem
                                            key={opt}
                                            onClick={() => handleChange('camera', opt)}
                                            className="focus:bg-stone-800 focus:text-white"
                                        >
                                            {opt}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* NEGATIVE PROMPT (NEGATE) */}
                            <div className="space-y-1">
                                <span className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">NEGATE</span>
                                <AutoResizeTextarea
                                    value={editValues.negativePrompt || ''}
                                    onChange={(e) => handleChange('negativePrompt', e.target.value)}
                                    className="min-h-[40px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-normal leading-relaxed placeholder:text-zinc-600"
                                    placeholder="No blur, distortions..."
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1 w-full h-full max-h-[70px] overflow-hidden">
                            <span className="text-xs text-white leading-tight font-sans font-extralight truncate block">{clip.camera || '+'}</span>
                            {clip.negativePrompt ? (
                                <div className="flex flex-col gap-0 mt-2">
                                    <span className="font-medium text-stone-500 text-[10px] tracking-wider uppercase">NEGATE</span>
                                    <span className="text-xs text-white leading-tight font-sans font-extralight line-clamp-2" title={clip.negativePrompt}>{clip.negativePrompt}</span>
                                </div>
                            ) : null}
                        </div>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top text-white w-[15%] py-3`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="leading-relaxed">
                    {isEditing ? (
                        <AutoResizeTextarea
                            value={editValues.action || ''}
                            onChange={(e) => handleChange('action', e.target.value)}
                            className="min-h-[80px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-thin leading-relaxed"
                        />
                    ) : (
                        <span className="text-xs text-white leading-tight font-sans font-thin line-clamp-3 text-ellipsis overflow-hidden whitespace-pre-wrap break-words" title={clip.action || ''}>{clip.action || '+'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className={`align-top text-white w-[15%] py-3`}>
                <EditableCell isEditing={isEditing} onStartEdit={handleStartEdit} className="text-white">
                    {isEditing ? (
                        <AutoResizeTextarea
                            value={editValues.dialog || ''}
                            onChange={(e) => handleChange('dialog', e.target.value)}
                            className="min-h-[80px] text-xs bg-stone-900 border-stone-700 text-white w-full font-sans font-thin leading-relaxed"
                        />
                    ) : (
                        <span className="text-xs text-white leading-tight font-sans font-thin line-clamp-3 text-ellipsis overflow-hidden whitespace-pre-wrap break-words" title={clip.dialog || ''}>{clip.dialog || '+'}</span>
                    )}
                </EditableCell>
            </TableCell>
            <TableCell className="align-top py-3 w-[80px] text-right">
                {isEditing ? (
                    <div className="flex flex-col gap-2 w-full">
                        <ImageUploadCell
                            value={editValues.refImageUrls || ''}
                            onChange={(url) => handleChange('refImageUrls', url)}
                            isEditing={true}
                            autoOpen={autoOpenUpload}
                            onAutoOpenComplete={() => setAutoOpenUpload(false)}
                            episode={clip.episode}
                        />
                    </div>
                ) : (
                    <div
                        className={`flex flex-wrap gap-1 w-full justify-end content-start rounded transition-colors ${isRefDragOver ? 'bg-stone-800 ring-2 ring-stone-600' : ''}`}
                        onClick={handleStartEdit}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsRefDragOver(true); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsRefDragOver(false); }}
                        onDrop={handleRefDropRef}
                    >
                        {renderedRefs.length > 0 ? (
                            renderedRefs.slice(0, 9).map((url, i) => (
                                <div key={url} className="w-[24px] h-[24px]">
                                    <MediaDisplay
                                        url={url}
                                        title={`Ref ${i + 1}`}
                                        className="w-full h-full object-cover rounded shadow-sm hover:opacity-80 transition-opacity"
                                        isReference={true}
                                        contentType="auto" // Let it auto-detect video vs image
                                        onUnlink={handleRefUnlink}
                                        onPlay={(clickedUrl) => {
                                            // 1. Build List of References (Rich Objects)
                                            const refItems = renderedRefs.map(rUrl => {
                                                const cleanUrl = rUrl.trim();
                                                const isVideo = cleanUrl.match(/\.(mp4|mov|webm|mkv)($|\?)/i);
                                                return {
                                                    id: cleanUrl,
                                                    url: cleanUrl,
                                                    type: (isVideo ? 'video' : 'image') as 'video' | 'image',
                                                    title: isVideo ? 'Reference Video' : 'Reference Image',
                                                    isReference: true,
                                                    ownerClipId: clip.id.toString()
                                                };
                                            });

                                            // 2. Build Result Items (History Support)
                                            let fullPlaylist = [...refItems];
                                            const resultUrls = parseStringList(clip.resultUrl || '');

                                            if (resultUrls.length > 0 && (clip.status === 'Done' || clip.status === 'Saved' || clip.status === 'Ready')) {
                                                const resultItems = resultUrls.map((resUrl, idx) => {
                                                    const isResVideo = resUrl.match(/\.(mp4|mov|webm|mkv)($|\?)/i);
                                                    // Only use the stored thumbnail for the MOST RECENT result (index 0)
                                                    const thumb = idx === 0 ? clip.thumbnailPath : undefined;

                                                    // Versioning Title: Most recent is base title, older ones get (vX)
                                                    // Logic: If 3 results, idx 0 = (Latest), idx 1 = (v2), idx 2 = (v1)
                                                    // Actually, simplified: "Result (History N)"
                                                    const baseTitle = getClipFilename(clip, seriesTitle).replace(/\.[^/.]+$/, "") || 'Result';
                                                    const verTitle = idx === 0 ? baseTitle : `${baseTitle} (History ${idx})`;

                                                    return {
                                                        id: `result-${clip.id}-${idx}`,
                                                        url: resUrl,
                                                        type: (isResVideo ? 'video' : 'image') as 'video' | 'image',
                                                        title: verTitle,
                                                        isReference: false,
                                                        ownerClipId: clip.id.toString(),
                                                        thumbnailPath: thumb
                                                    };
                                                });

                                                // Prepend Results to Playlist
                                                fullPlaylist = [...resultItems, ...refItems];
                                            }

                                            // 3. Append Character/Location Images
                                            const charItems = (clip.characterImageUrls || []).map(u => ({
                                                id: u, url: u, type: 'image' as const, title: 'Character Ref', isReference: true, ownerClipId: clip.id.toString()
                                            }));
                                            const locItems = (clip.locationImageUrls || []).map(u => ({
                                                id: u, url: u, type: 'image' as const, title: 'Location Ref', isReference: true, ownerClipId: clip.id.toString()
                                            }));

                                            fullPlaylist = [...fullPlaylist, ...charItems, ...locItems];

                                            onPlay(clickedUrl, fullPlaylist);
                                        }}
                                    // Pass specific delete handler if needed, but MediaDisplay usually handles internal logic
                                    />
                                </div>
                            ))
                        ) : (
                            <div className="w-full h-full flex items-center justify-end text-stone-600 text-[10px] px-2 opacity-50 group-hover:opacity-100">
                                Drop Refs
                            </div>
                        )}
                    </div>
                )}
            </TableCell >

            {/* --- REFACTOR START: SHARED COMPONENTS --- */}

            < TableCell className="align-top py-3 w-[80px] text-left" >
                {/* RESULT Column using MediaDisplay */}
                {
                    clip.status?.toUpperCase() === 'GENERATING' ? (
                        <div className="flex items-center justify-center w-[70px] h-[70px] bg-stone-900 border border-stone-800 rounded-md">
                            <Loader2 className="h-6 w-6 text-primary animate-spin" />
                        </div>
                    ) : (clip.resultUrl) && (
                        <div className={`flex justify-start relative ${clip.status?.startsWith('Error') ? 'opacity-50 grayscale border-red-500 border-2 rounded-md' : ''}`}>
                            {/* Visual Warning for Stale/Error State */}
                            {clip.status?.startsWith('Error') && (
                                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                    <span className="material-symbols-outlined text-red-500 bg-black/50 rounded-full p-1">warning</span>
                                </div>
                            )}
                            <MediaDisplay
                                // Safe URL Extraction for single display: Use ParseStringList[0]
                                url={clip.thumbnailPath || parseStringList(clip.resultUrl)[0]}
                                originalUrl={parseStringList(clip.resultUrl)[0]}
                                model={clip.model}
                                title={getClipFilename(clip, seriesTitle).replace(/\.[^/.]+$/, "")}
                                isThumbnail={!!clip.thumbnailPath}
                                contentType={
                                    (() => {
                                        const urls = parseStringList(clip.resultUrl || '');
                                        const primaryUrl = urls[0] || '';
                                        const isVideoExt = primaryUrl.match(/\.(mp4|mov|webm|mkv)($|\?)/i);
                                        const isVideoModel = (clip.model?.toLowerCase().includes('veo') || clip.model?.toLowerCase().includes('kling') || clip.model?.toLowerCase().includes('minimax') || clip.model?.toLowerCase().includes('luma'));

                                        // If extension is explicit image, force image.
                                        if (primaryUrl.match(/\.(png|jpg|jpeg|webp)($|\?)/i)) return 'image';

                                        // Otherwise fallback to extension check OR model check
                                        return (isVideoExt || isVideoModel) ? 'video' : 'image';
                                    })()
                                }
                                onPlay={(url) => {
                                    // RESTORED: Include Characters and Locations in Playlist
                                    const explicitRefs = getCleanExplicitRefs();
                                    const charImages = clip.characterImageUrls || [];
                                    const locImages = clip.locationImageUrls || [];

                                    // Unified Playlist: Result -> Explicit -> Chars -> Locs
                                    const fullPlaylist = [url, ...explicitRefs, ...charImages, ...locImages].filter(Boolean);
                                    onPlay(url, fullPlaylist);
                                }}
                                className="w-[70px] max-h-[70px] aspect-square object-cover rounded-md overflow-hidden border border-stone-800 shadow-sm"
                                onUseAsRef={(url) => {
                                    // Sideload Logic: Append current Result URL to Ref Headers
                                    const currentRefs = parseStringList(clip.explicitRefUrls || clip.refImageUrls);
                                    if (!currentRefs.includes(url)) {
                                        const next = [...currentRefs, url].join(',');
                                        onSave(clip.id, { refImageUrls: next, explicitRefUrls: next }); // Save new Explicit List
                                    } else {
                                        alert("This image is already a reference.");
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
                    status={clip.status || ''}
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

