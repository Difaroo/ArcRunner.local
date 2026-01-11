export type ApiStrategyType = 'veo' | 'flux' | 'nano' | 'kling';

export interface ModelConfig {
    id: string;              // Unique ID (e.g. 'veo-quality')
    label: string;           // UI Display Name
    apiStrategy: ApiStrategyType; // Which Kie Strategy to use
    builderId: string;       // Which PayloadBuilder to use (usually matches apiStrategy)
    isImage: boolean;        // Helper for UI icons (Video vs Image)
    internalId?: string;     // Override for backend API (e.g. 'flux-2/flex-image-to-image')
    description?: string;    // Tooltip description
    hasAudio?: boolean;      // If true, shows Audio Toggle in UI
}

export const MODELS: Record<string, ModelConfig> = {
    'veo-fast': {
        id: 'veo-fast',
        label: 'Veo Fast',
        apiStrategy: 'veo',
        builderId: 'veo',
        isImage: false,
        internalId: 'veo3_fast', // Default internal ID
        description: 'Fast video generation'
    },
    'veo-quality': {
        id: 'veo-quality',
        label: 'Veo Quality',
        apiStrategy: 'veo',
        builderId: 'veo',
        isImage: false,
        internalId: 'veo3', // Quality model
        description: 'High quality video generation'
    },
    'veo-s2e': {
        id: 'veo-s2e',
        label: 'Veo Start 2 End',
        apiStrategy: 'veo',
        builderId: 'veo',
        isImage: false,
        internalId: 'veo3_fast', // S2E uses Fast backend usually
        description: 'Generate video transition between two images'
    },
    'kling-2.6': {
        id: 'kling-2.6',
        label: 'Kling 2.6',
        apiStrategy: 'kling',
        builderId: 'kling',
        isImage: false,
        internalId: 'kling-2.6/image-to-video',
        description: 'Kling audio-visual generation',
        hasAudio: true
    },
    'flux-pro': {
        id: 'flux-pro',
        label: 'Flux Pro',
        apiStrategy: 'flux',
        builderId: 'flux',
        isImage: true,
        internalId: 'flux-2/flex-image-to-image', // Flux strategy usually expects specific payload structure
        description: 'Pro quality image generation'
    },
    'flux-flex': {
        id: 'flux-flex',
        label: 'Flux Flex',
        apiStrategy: 'flux',
        builderId: 'flux',
        isImage: true,
        internalId: 'flux-2/flex-image-to-image',
        description: 'Flexible image generation'
    },
    'nano-banana-pro': {
        id: 'nano-banana-pro',
        label: 'Nano Banana Pro',
        apiStrategy: 'nano',
        builderId: 'nano',
        isImage: false, // Nano produces video
        internalId: 'nano-banana-pro',
        description: 'Nano model generation'
    }
};

export const MODEL_LIST = Object.values(MODELS);

/**
 * Safe retrieval of model config. Defaults to 'veo-fast' if unknown.
 */
export const getModelConfig = (id: string | undefined | null): ModelConfig => {
    if (!id) return MODELS['veo-fast'];
    return MODELS[id] || MODELS['veo-fast'];
};
