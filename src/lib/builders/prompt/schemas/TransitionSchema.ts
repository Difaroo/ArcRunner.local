import { GenerationContext } from '../../PayloadBuilder';
import { ImageManifest, PromptSchema } from '../types';

export class TransitionSchema implements PromptSchema {

    format(context: GenerationContext, manifest: ImageManifest): string {
        const { input } = context;

        // S2E Template
        const instruction = "[INSTRUCTION: Transitions from Start Frame (Image 1) to End Frame (Image 2).] (If images provided)";

        // Subject Body (Composite from Input or rebuilt?)
        // Ideally we reuse the new structured components if available, but S2E is usually simpler.
        // Let's use the 'Standard' body components but wrapped in Transition logic.

        const actionText = input.clip.action || "";
        const subNegs = input.subjectNegatives || "";

        // We can optionally verify manifests here
        // if (manifest.selectedUrls.length < 2) ... 

        const body = `ACTION: ${actionText}`;
        const negs = subNegs ? `\nNO: [${subNegs}]` : "";

        return `${instruction}\n\n${body}${negs}`;
    }
}
