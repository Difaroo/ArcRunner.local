import { useState, useRef } from 'react';
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
import { Input } from "@/components/ui/input";
import { X, Loader2 } from "lucide-react";

interface ImageUploadCellProps {
    value: string;
    onChange: (value: string) => void;
    isEditing: boolean;
}

export function ImageUploadCell({ value, onChange, isEditing }: ImageUploadCellProps) {
    const [uploading, setUploading] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<string | null>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            const data = await res.json();
            const newUrl = data.url;

            // Append to existing URLs
            const currentUrls = value ? value.split(',').map(u => u.trim()).filter(Boolean) : [];
            const newUrls = [...currentUrls, newUrl];
            onChange(newUrls.join(','));

        } catch (err) {
            console.error('Upload error:', err);
            alert('Failed to upload image');
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
            <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <Input
                        type="file"
                        accept="image/*"
                        onChange={handleUpload}
                        disabled={uploading}
                        className="h-8 w-24 text-xs text-transparent file:mr-0 file:py-0 file:px-2 file:rounded-sm file:border-0 file:text-xs file:font-medium file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80"
                    />
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <div className="flex flex-wrap gap-2 mb-0">
                    {imageUrls.map((url, idx) => (
                        <div key={idx} className="relative group">
                            <div className="w-10 h-10 rounded overflow-hidden border border-stone-700 bg-stone-900">
                                <img
                                    src={url.startsWith('/api/images') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`}
                                    alt="Thumbnail"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(url);
                                }}
                                className="absolute -top-1 -right-1 bg-stone-900 rounded-full p-0.5 shadow-sm border border-stone-700 hover:bg-stone-800 transition-colors z-10"
                                title="Delete image"
                            >
                                <X className="h-3 w-3 text-primary" />
                            </button>
                        </div>
                    ))}
                </div>

                <AlertDialog open={!!imageToDelete} onOpenChange={(open) => !open && setImageToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Image</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this image?
                                <br />
                                <span className="font-mono text-xs mt-2 block break-all">{imageToDelete?.split('/').pop()}</span>
                            </AlertDialogDescription>
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
            <div className="relative w-24 h-auto rounded-md overflow-hidden border border-black bg-stone-900 ml-auto group">
                <img
                    src={imageUrl.startsWith('/api/images') ? imageUrl : `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`}
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
            <Button
                variant="outline"
                size="sm"
                className="h-8 w-full border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary"
            >
                <span className="material-symbols-outlined !text-lg">add</span>
            </Button>
        </div>
    );
}
