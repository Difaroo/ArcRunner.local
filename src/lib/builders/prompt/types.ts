import { GenerationContext } from '../PayloadBuilder';

/**
 * Structured breakdown of the selected images and their assigned roles.
 * Logic Layer Output.
 */
export interface ImageManifest {
    // The flat array of URLs to be sent to the API
    selectedUrls: string[];

    // Mappings: 1-based index in the selectedUrls array. 0 = Not Present.
    slots: {
        location: number;
        characters: number[]; // Array of indices, one per context.characterImages
        style: number;        // Specific index of the style image if selected
        references: number[]; // Indices of generic references
    };

    // Diagnostics / Metadata
    counts: {
        total: number;
        chars: number;
        refs: number;
    };
}

/**
 * Strategy Interface for formatting the final text prompt.
 * Presentation Layer.
 */
export interface PromptSchema {
    /**
     * Formats the prompt based on the context and the selected image manifest.
     */
    format(context: GenerationContext, manifest: ImageManifest): string;
}
