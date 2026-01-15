import { NanoSchema } from './src/lib/builders/prompt/schemas/NanoSchema';
import { GenerationContext } from './src/lib/builders/PayloadBuilder';
import { ImageManifest } from './src/lib/builders/prompt/types';

// Simulate a Studio Library Item generation (Desert Oasis)
const context: GenerationContext = {
    input: {
        clipId: '244',
        seriesId: 'ac28ec95-63ea-47ee-a190-19253dd939b1',
        model: 'nano-banana-pro',
        aspectRatio: '16:9',
        subjectName: 'Desert_Oasis_Right',
        subjectDescription: 'ESSENTIAL: move pov down to the waters edge amongst the palm trees. [Reference image 1 for the positioning of the palm trees and canyon walls.] Rotate camera 120 degrees to the right, looking straight on to the canyon wall ruins on the right, 50m away, filling the view. Pull in so that the ruins tower over us. The view is across the sand, looking through the palm trees. The water is out of shot behind us. The moon is out of frame, shining from the right.',
        clip: {
            id: '244',
            action: '', // Empty for Studio items
            dialog: '',
            character: '',
            location: '',
            camera: '',
            style: '',
            negativePrompt: ''
        } as any,
        seed: 1220
    },
    characterImages: [],
    locationImages: [],
    explicitImages: ['https://tempfile.redpandaai.co/kieai/127378/temp_uploads/Oasis_Nano_02.jpeg'],
    styleImage: null,
    characterAssets: [],
    locationAsset: undefined,
    styleAsset: undefined,
    cameraAsset: undefined,
    publicImageUrls: ['https://tempfile.redpandaai.co/kieai/127378/temp_uploads/Oasis_Nano_02.jpeg']
};

// Simulate the manifest from PromptSelector
const manifest: ImageManifest = {
    selectedUrls: ['https://tempfile.redpandaai.co/kieai/127378/temp_uploads/Oasis_Nano_02.jpeg'],
    slots: {
        location: 0, // No location
        characters: [], // No characters
        style: 0, // No style
        references: [1] // Explicit image is reference 1
    },
    counts: {
        total: 1,
        chars: 0,
        refs: 1
    }
};

const schema = new NanoSchema();
const result = schema.format(context, manifest);

console.log('=== GENERATED PROMPT ===\n');
console.log(result.prompt);
console.log('\n=== NEGATIVE PROMPT ===\n');
console.log(result.negativePrompt || '(none)');
