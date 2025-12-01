import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";

interface ImageUploadCellProps {
    imageUrl?: string;
    onChange: (url: string) => void;
    isEditing: boolean;
}

export function ImageUploadCell({ imageUrl, onChange, isEditing }: ImageUploadCellProps) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            onChange(data.url);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload image');
        } finally {
            setUploading(false);
            // Reset input so same file can be selected again if needed
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileSelect}
                />
                <div className="flex-1 flex gap-2">
                    <input
                        type="text"
                        value={imageUrl || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className="flex-1 h-8 text-xs bg-stone-900 border border-stone-700 text-white px-2 rounded"
                        placeholder="Image URL or Upload ->"
                    />
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="h-8 w-8 border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary rounded-full shrink-0"
                        title="Upload Image"
                    >
                        {uploading ? (
                            <span className="material-symbols-outlined animate-spin !text-lg">sync</span>
                        ) : (
                            <span className="material-symbols-outlined !text-lg">add</span>
                        )}
                    </Button>
                </div>
            </div>
        );
    }

    // Display Mode
    if (imageUrl) {
        return (
            <div className="relative w-24 h-32 rounded-md overflow-hidden border border-stone-700 bg-stone-900 ml-auto group">
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
