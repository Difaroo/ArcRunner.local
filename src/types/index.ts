export interface Clip {
    id: string;
    scene: string;
    title: string;
    character: string;
    location: string;
    style: string;
    camera: string;
    movement?: string; // Phase 4 Migration
    action: string;
    dialog: string;
    characterImageUrls?: string[];
    locationImageUrls?: string[];
    status: string;
    resultUrl?: string;
    remoteResultUrl?: string; // Phase 4 Migration
    taskId?: string;
    isPersisted?: boolean; // Optimistic flag
    episodeId?: string; // Relation ID
    episode?: string; // Legacy or explicit relation object? Type says string.
    series?: string;
    sortOrder?: number;
    model?: string;
    isHiddenInStoryboard?: boolean;
    isSelected?: boolean;
    thumbnailPath?: string;
    negativePrompt?: string | null;
    mediaReferences?: Media[]; // Phase 4: Normalized Relations
    mediaResults?: Media[]; // Phase 4: Normalized Results
    modelInputSlots?: {
        id: string;
        mediaId: string;
        studioItemId?: number | null;
        sortOrder: number;
        media: Media | null;
        studioItem?: {
            id: number;
            name: string;
            refImageUrl?: string;
            thumbnailPath?: string;
            type?: string;
        } | null;
    }[];
    // Locking
    lockedBy?: string | null;
    lockedAt?: string | Date | null;
}

export interface Media {
    id: string;
    url: string;
    type: string; // "IMAGE" | "VIDEO"
    category: string; // "REFERENCE" | "RESULT"
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
    createdAt?: string | Date;
    refImageSort?: number;
    studioItem?: { name: string }; // Relation
}

export interface Series {
    id: string;
    title: string;
    totalEpisodes: string;
    currentEpisodes: string;
    status: string;
    defaultModel: string;
}

export interface LibraryItem {
    id: string; // Row index or unique ID
    type: string;
    name: string;
    description: string;
    refImageUrl: string;
    thumbnailPath?: string;
    negatives: string;
    notes: string;
    episode: string;
    series: string;
    status?: string;
    taskId?: string;
    model?: string | null;
}

export interface Episode {
    series: string;
    id: string;
    uuid: string;
    title: string;
    model?: string;
    style?: string;
    guidance?: number;
    seed?: number | null;
    aspectRatio?: string;
}
