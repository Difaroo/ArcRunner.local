export interface FluxPayload {
    model: string; // 'flux-2/pro-image-to-image'
    callBackUrl?: string;
    seed?: number; // Root level fallback
    input: {
        prompt: string;
        aspect_ratio: string; // '16:9'
        resolution: string; // '2K'
        input_urls?: string[]; // NEW SPEC
        image_ref_urls?: string[]; // LEGACY
        disable_safety_checker?: boolean;
        guidance_scale?: number; // 1.0 - 10.0
        num_inference_steps?: number; // 4 - 50
        [key: string]: any;
    };
}

export interface VeoPayload {
    model: string; // 'veo-2'
    prompt: string;
    imageUrls?: string[]; // Array required (e.g. for REFERENCE_2_VIDEO)
    aspectRatio?: string; // camelCase e.g. "16:9"
    durationType?: string; // "5" or "10"
    generationType?: string; // "REFERENCE_2_VIDEO" or "TEXT_2_VIDEO"
    enableTranslation?: boolean;
    enableFallback?: boolean;
    watermark?: string;
    callBackUrl?: string;
    seeds?: number;
    [key: string]: any;
}

export type AppStatus = 'Generating' | 'Done' | 'Error';
