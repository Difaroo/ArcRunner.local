
import { GenerationContext } from './PayloadBuilder';

export interface ConstructedPrompt {
    prompt: string;
    imageUrls: string[];
    warnings: string[];
}

export class PromptConstructor {

    static construct(context: GenerationContext): ConstructedPrompt {
        const { input, characterImages, locationImages, explicitImages } = context;
        const warnings: string[] = [];

        // --- 1. Determine Logic State ---

        // State E: S2E (Start-to-End)
        const isS2E = input.model === 'veo-s2e';

        // State C: Style Image (The Sandwich) with Validity Check
        // We only consider it "Style Image" mode if we actually have images to work with
        // and the user provided a style index (though user logic implies explicit image = style?)
        // User logic: "If Style image..." -> This usually implies a specific slot or the 'refImageUrls' contains it?
        // Actually, current UI allows picking a "Style" asset which has an image.
        // BUT the PromptConstructor receives "explicitImages" (the clip's refs)
        // and "styleImageIndex".
        // If styleImageIndex is set, it refers to the index in the FINAL array?
        // Or does it refer to a specific image passed in?
        //
        // "3. State C (Style Image): Slot 3: Style Image (Always last/3rd if present)."
        // This implies we look for a Style Asset Image?
        // context doesn't have `styleImages`.
        // Wait, `GenerateManager` resolves `styleItem`. Does it pass style image?
        // Currently `GenerateManager` DOES NOT resolve style images into the image list.
        // It only resolves Char, Loc, and Clip Refs.
        //
        // HYPOTHESIS: The user adds the Style Image to the *Clip References* manually?
        // OR the system should resolve it?
        //
        // Re-reading user request: "If there is a style image, it overrides ref images"
        // And "User selects 'Oil Paint' style with ref image."
        //
        // I will assume for now that if `input.styleImageIndex` is provided, 
        // it means one of the images IS the style image.
        // BUT the user logic says "Slot 3: Style Image".
        // This implies we must FIND it.
        //
        // Let's stick to the EXPLICIT logic:
        // "uses Ref image 1 for start, and 2 for end" (S2E)

        // For standard "Image Logic":
        // "If Style image" -> We need to know if a style image exists.
        // I will add `styleImage` to Context? Or assume it's in explicit?
        //
        // Let's assume the "Style Image" comes from the Style Asset if it has one.
        // I'll need to update GenerateManager to pass `styleImage`.

        // For now, I will code the logic assuming `context.styleImage` exists (single string or null).
        // I will likely need to update `GenerationContext` one more time.

        return {
            prompt: "",
            imageUrls: [],
            warnings: ["Incomplete Implementation"]
        }
    }
}
