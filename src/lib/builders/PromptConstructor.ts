import { GenerationContext } from './PayloadBuilder';
import { PromptSelector } from './prompt/PromptSelector';
import { PromptSchema } from './prompt/types';
import { StandardSchema } from './prompt/schemas/StandardSchema';
import { TransitionSchema } from './prompt/schemas/TransitionSchema';
import { LegacySchema } from './prompt/schemas/LegacySchema';
import { NanoSchema } from './prompt/schemas/NanoSchema';

export interface ConstructedPrompt {
    prompt: string;
    imageUrls: string[];
    warnings: string[];
}

/**
 * Orchestrator Class (Factory Pattern).
 * Coordinates Logic (Selector) and Presentation (Schemas).
 */
export class PromptConstructor {

    // Stateless Schema Instances (Singletons for Efficiency)
    private static standardSchema = new StandardSchema();
    private static transitionSchema = new TransitionSchema();
    private static legacySchema = new LegacySchema();
    private static nanoSchema = new NanoSchema();

    static construct(context: GenerationContext): ConstructedPrompt {
        const { input } = context;
        const warnings: string[] = [];

        // 1. Logic Phase: Select Images and Build Manifest
        // Complexity O(n) - Single pass
        const manifest = PromptSelector.select(context);

        // 2. Factory Phase: Select Schema Strategy
        let schema: PromptSchema;
        const model = (input.model || "").toLowerCase();

        if (model === 'veo-s2e') {
            schema = this.transitionSchema;
        } else if (model.includes('flux')) {
            schema = this.legacySchema;
        } else if (model.includes('nano') || model.includes('banana')) {
            schema = this.nanoSchema;
        } else {
            // Default (Veo Standard, Veo Quality, Kling, etc.)
            schema = this.standardSchema;
        }

        // 3. Presentation Phase: Format Text
        let finalPrompt = "";
        try {
            finalPrompt = schema.format(context, manifest);
        } catch (err) {
            console.error('[PromptConstructor] Schema Format Failed:', err);
            warnings.push(`Schema Error: ${err}`);
            // Fallback to minimal safety prompt
            finalPrompt = input.subjectDescription || "Error building prompt.";
        }

        // Logging for Debugging
        console.log(`[PromptConstructor] Model=${model} -> Schema=${schema.constructor.name}. Selected Images=${manifest.selectedUrls.length}`);

        return {
            prompt: finalPrompt,
            imageUrls: manifest.selectedUrls,
            warnings
        };
    }
}
