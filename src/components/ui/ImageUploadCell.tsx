import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { X, Loader2 } from "lucide-react";

interface ImageUploadCellProps {
    value: string;
    onChange: (value: string) => void;
    isEditing: boolean;
    autoOpen?: boolean;
    onAutoOpenComplete?: () => void;
    episode?: string; // Add episode prop
}

export function ImageUploadCell({ value, onChange, isEditing, autoOpen, onAutoOpenComplete, episode }: ImageUploadCellProps) {
    const [uploading, setUploading] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-open file dialog if requested
    useEffect(() => {
        if (autoOpen && isEditing && fileInputRef.current) {
            // We need a slight delay to ensure the input is mounted and visible (even if hidden)
            const timer = setTimeout(() => {
                fileInputRef.current?.click();
                onAutoOpenComplete?.();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [autoOpen, isEditing, onAutoOpenComplete]);


    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (episode) formData.append('episode', episode);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Upload failed');
            }

            const data = await res.json();
            const newUrl = data.url;

            // Append to existing URLs
            const currentUrls = value ? value.split(',').map(u => u.trim()).filter(Boolean) : [];
            const newUrls = [...currentUrls, newUrl];
            onChange(newUrls.join(','));

        } catch (err: any) {
            console.error('Upload error:', err);
            alert(`Failed to upload image: ${err.message}`);
        } finally {
            setUploading(false);
            // Reset input so same file can be selected again if needed
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteClick = (url: string) => {
        setImageToDelete(url);
    };

    const confirmDelete = () => {
        if (!imageToDelete) return;
        const currentUrls = value ? value.split(',').map(u => u.trim()).filter(Boolean) : [];
        const newUrls = currentUrls.filter(u => u !== imageToDelete);
        onChange(newUrls.join(','));
        setImageToDelete(null);
    };

    const imageUrls = value ? value.split(',').map(u => u.trim()).filter(Boolean) : [];
    // For display, prioritize library images if any, otherwise show first clip image
    // But for editing, we show all clip images
    const imageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

    if (isEditing) {
        return (
            <div className="flex flex-row items-start gap-2">
                <div className="flex items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUpload}
                        disabled={uploading}
                        className="hidden"
                    />
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="btn-icon-action p-0"
                                >
                                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined !text-lg">add</span>}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Upload Image</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className="flex flex-wrap gap-2 mb-0">
                    {imageUrls.map((url, idx) => (
                        <div key={idx} className="relative group">
                            <div className="w-10 h-10 rounded overflow-hidden border border-stone-700 bg-stone-900">
                                <img
                                    src={url.startsWith('/api/') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                    alt="Thumbnail"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClick(url);
                                            }}
                                            className="absolute -top-1 -right-1 bg-stone-900 rounded-full p-0.5 shadow-sm border border-stone-700 hover:bg-stone-800 transition-colors z-10"
                                        >
                                            <X className="h-3 w-3 text-primary" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Delete image</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    ))}
                </div>

                <AlertDialog open={!!imageToDelete} onOpenChange={(open) => !open && setImageToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Image</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this image?
                            </AlertDialogDescription>
                            <div className="flex justify-center py-4">
                                {imageToDelete && (
                                    <div className="w-32 h-32 rounded-md overflow-hidden border border-stone-700 bg-stone-900">
                                        <img
                                            src={imageToDelete.startsWith('/api/') ? imageToDelete : `/api/proxy-image?url=${encodeURIComponent(imageToDelete)}`}
                                            alt="To Delete"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setImageToDelete(null)} className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        );
    }

    // Display Mode
    if (imageUrl) {
        return (
            <div className="relative w-24 h-24 rounded-md overflow-hidden border border-black bg-stone-900 ml-auto group">
                <img
                    src={imageUrl.startsWith('/api/') ? imageUrl : `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`}
                    alt="Ref"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                    onError={(e) => {
                        // Fallback if image fails to load
                        (e.target as HTMLImageElement).src = 'https://placehold.co/100x150/1a1a1a/666?text=Error';
                    }}
                />
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-[40px] flex items-center justify-center">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="btn-icon-action w-full"
                        >
                            <span className="material-symbols-outlined !text-lg">add</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Add Reference Image</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}
