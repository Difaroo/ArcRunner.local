import { GenerationContext } from '../../PayloadBuilder';
import { ImageManifest, PromptSchema } from '../types';

export class LegacySchema implements PromptSchema {

    format(context: GenerationContext, manifest: ImageManifest): string {
        const { input } = context;

        // Legacy "Flat" prompt used for Flux or simple models.
        // Ignores intricate ABCD structure in favor of a dense description.

        // Use the composite description if available (from GenerateManager), 
        // or rebuild a simple one.
        // Note: GenerateManager populates input.subjectDescription with the "At Location. Character..." string.

        // If we want to rely on the *new* robust selector, we can.
        // But Legacy usually means "don't change what works".
        // Flux expects a single text block.

        const subject = input.subjectDescription || input.clip.prompt || "";
        const style = input.styleDescription || input.styleName || "Cinematic";

        return `${style}. ${subject}.`;
    }
}
