import fetch from 'node-fetch';
if (!global.fetch) {
    (global as any).fetch = fetch;
}
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback

import { createVeoTask, uploadFileBase64 } from '@/lib/kie';


async function main() {
    console.log('--- Probing Veo-2 API ---');
    console.log('Key length:', process.env.KIE_API_KEY?.length);

    // Test 1: Text-to-Video (veo) - CAMEL CASE
    console.log('\n[Test 1] Text-to-Video (veo) - CamelCase');
    try {
        const res1 = await createVeoTask({
            model: 'veo',
            prompt: "A red ball bouncing",
            aspectRatio: "16:9",
            durationType: "5"
        });
        console.log('T2V (Camel) Result:', JSON.stringify(res1, null, 2));
    } catch (e: any) {
        console.error('T2V (Camel) Failed:', e.message || e);
    }

    // Test 1b: Text-to-Video (veo) - SNAKE CASE (Manual Fetch to bypass type checks)
    console.log('\n[Test 1b] Text-to-Video (veo) - Snake_Case');
    try {
        const res1b = await (global as any).fetch('https://api.kie.ai/api/v1/veo/generate', {
            method: 'POST',
            headers: {
                'x-api-key': process.env.KIE_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'veo',
                prompt: "A red ball bouncing",
                aspect_ratio: "16:9",
                duration_type: "5"
            })
        }).then((r: any) => r.json());
        console.log('T2V (Snake) Result:', JSON.stringify(res1b, null, 2));
    } catch (e: any) {
        console.error('T2V (Snake) Failed:', e.message || e);
    }

    // Test 2: Image-to-Video (Upload + Generate)
    console.log('\n[Test 2] Image-to-Video (veo-2)');
    try {
        // Create 1x1 pixel red PNG base64
        const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        const up = await uploadFileBase64(b64, "pixel.png");
        // FIX: check downloadUrl
        const url = up.data?.downloadUrl || up.data?.url || up.url;

        console.log('Uploaded Url:', url);

        if (!url) throw new Error("Upload failed to return URL");

        const res2 = await createVeoTask({
            model: 'veo-2',
            prompt: "A red ball bouncing",
            imageUrl: url,
            aspectRatio: "16:9",
            durationType: "5"
        });
        console.log('I2V Result:', JSON.stringify(res2, null, 2));

    } catch (e: any) {
        console.error('I2V Failed:', e.message || e);
    }
}

main().catch(console.error);
