export interface Clip {
    id: string;
    scene: string;
    title: string;
    character: string;
    location: string;
    style: string;
    camera: string;
    action: string;
    dialog: string;
    refImageUrls: string;
    explicitRefUrls: string;
    characterImageUrls?: string[];
    locationImageUrls?: string[];
    status: string;
    resultUrl?: string;
    taskId?: string;
    seed?: string;
    episode?: string;
    series?: string;
    sortOrder?: number;
    model?: string;
    isHiddenInStoryboard?: boolean;
    thumbnailPath?: string;
    negativePrompt?: string | null;
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
