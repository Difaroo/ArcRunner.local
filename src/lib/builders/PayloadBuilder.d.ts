import { GenerateTaskInput } from '@/lib/generate-manager';

export interface GenerationContext {
    input: GenerateTaskInput;
    publicImageUrls: string[]; // Legacy/Fallback
    // Granular Public URLs for logic
    characterImages: string[];
    locationImages: string[];
    explicitImages: string[];
    styleImage: string | null;

    // Rich Asset Data (For Prompt Constructor)
    locationAsset?: { name: string; description: string; negatives?: string };
    characterAssets: { name: string; description: string; negatives?: string; refImageUrl?: string }[];
    cameraAsset?: { description: string; negatives?: string };
    styleAsset?: { description: string; negatives?: string };
}

export interface PayloadBuilder {
    supports(modelId: string): boolean;
    /**
     * Validates construction context before building.
     * Throws Error if invalid.
     */
    validate(context: GenerationContext): void;
    build(context: GenerationContext): any;
}
