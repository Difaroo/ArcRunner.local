
import { createFluxTask, createVeoTask, FluxPayload, VeoPayload } from '../src/lib/kie';
import { GenerateManager } from '../src/lib/generate-manager';

// Mock Fetch
global.fetch = async (url: any, options: any) => {
    console.log(`[MOCK FETCH] URL: ${url}`);
    if (options.body) {
        console.log(`[PAYLOAD]:`, JSON.stringify(JSON.parse(options.body), null, 2));
    }
    return {
        ok: true,
        json: async () => ({ data: { taskId: 'mock-task-123' } })
    } as any;
};

// Mock Kie Env
process.env.KIE_API_KEY = 'mock-key';

async function verify() {
    console.log('\n--- Verifying Veo Payload (via Manager Logic Mock) ---');

    // Simulate what GenerateManager does
    const payload: VeoPayload = {
        model: 'veo-2',
        prompt: "A cinematic shot of a car chase",
        aspectRatio: "16:9",
        imageUrl: "https://example.com/image.jpg",
        durationType: "5"
    };

    console.log('Testing createVeoTask with strictly typed payload...');
    await createVeoTask(payload);
}

verify().catch(console.error);
