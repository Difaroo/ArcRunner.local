import { VeoPayloadBuilder } from '../src/lib/builders/VeoPayloadBuilder';
import { VeoPayload } from '../src/lib/kie-types';

// Mock Data
const mockInput = {
    clipId: '171',
    seriesId: '1',
    model: 'veo3_fast', // Pre-normalized
    prompt: 'A test prompt',
    aspectRatio: '16:9',
    clip: {
        duration: '5',
        action: 'Test action',
        dialog: 'Test dialog',
        style: 'Noir',
        camera: 'Wide'
    }
};

const mockImages = [
    'https://tempfile.redpandaai.co/kieai/123/test1.png',
    'https://tempfile.redpandaai.co/kieai/123/test2.png'
];

async function verify() {
    console.log('--- Verifying VeoPayloadBuilder ---');

    // 1. Run New Builder
    const builder = new VeoPayloadBuilder();
    const newPayload = builder.build({
        input: mockInput,
        publicImageUrls: mockImages
    });

    console.log('New Payload:', JSON.stringify(newPayload, null, 2));

    // 2. Run Legacy Logic (Manually pasted from GenerateManager)
    const legacyPayload = runLegacyLogic(mockInput, mockImages);
    console.log('Legacy Payload:', JSON.stringify(legacyPayload, null, 2));

    // 3. Compare
    const isMatch = JSON.stringify(newPayload) === JSON.stringify(legacyPayload);

    if (isMatch) {
        console.log('SUCCESS: Payloads match exactly!');
        process.exit(0);
    } else {
        console.error('FAILURE: Payloads do NOT match!');
        process.exit(1);
    }
}

// EXACT Legacy Logic from GenerateManager (Lines 100-143 approx)
function runLegacyLogic(input: any, imageUrls: string[]): VeoPayload {
    const model = 'veo3_fast'; // Hardcoded in legacy block context

    // Note: prompt logic in legacy was: input.clip.prompt || buildPrompt(...)
    // Here we simulate the manager passing the prompt into input.prompt or building it.
    // In Builder we used: input.prompt || buildPrompt...
    // Let's assume input.prompt IS provided for this test.

    const finalPrompt = input.prompt || `Cinematic shot. ${input.clip.action || ''} ${input.clip.dialog ? `Character says: "${input.clip.dialog}"` : ''}. ${input.clip.style || ''}. ${input.clip.camera || ''}. High quality.`;

    const payload: VeoPayload = {
        model: 'veo3_fast', // Strict match user requirement
        prompt: finalPrompt,
        aspectRatio: input.aspectRatio || '16:9',
        durationType: input.clip.duration || '5',
        enableTranslation: true,
        enableFallback: false
    };

    if (imageUrls.length > 0) {
        payload.imageUrls = imageUrls; // Array!
        payload.generationType = 'REFERENCE_2_VIDEO';
        // console.log([GenerateManager] Image-to-Video detected. Using veo3_fast.`);
    } else {
        payload.generationType = 'TEXT_2_VIDEO'; // Optional fallback
    }
    return payload;
}

verify();
