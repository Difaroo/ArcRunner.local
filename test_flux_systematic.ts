
import fs from 'fs';
import path from 'path';

// Parse .env.local manually to avoid dotenv dependency issues if any
const envPath = path.resolve(process.cwd(), '.env.local');
let KIE_API_KEY = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    KIE_API_KEY = envContent.split('\n')
        .find(line => line.startsWith('KIE_API_KEY='))
        ?.split('=')[1]
        ?.trim() || '';
} catch (e) {
    console.error("Could not read .env.local", e);
}

if (!KIE_API_KEY) {
    console.error("Could not find KIE_API_KEY in .env.local");
    process.exit(1);
}

async function testModel(modelName: string, includeImages: boolean) {
    console.log(`\n--- Testing Model: ${modelName} (Images: ${includeImages}) ---`);
    const payload = {
        model: modelName,
        input: {
            prompt: "A futuristic cityscape with neon lights, cinematic style.",
            aspect_ratio: "16:9",
            resolution: "1K",
            disable_safety_checker: true,
            ...(includeImages ? { input_urls: ["https://upload.wikimedia.org/wikipedia/commons/7/70/Example.png"] } : {})
        }
    };

    try {
        console.log("Payload:", JSON.stringify(payload, null, 2));
        const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${KIE_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log(`Response Status: ${res.status}`);
        console.log("Response Body:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

async function runTests() {
    console.log("Starting Systematic Flux Tests...");

    // 1. Test T2I candidates
    await testModel("flux-pro", false);
    await testModel("flux-1.1-pro", false);
    // await testModel("flux", false); // Likely alias for flex or pro

    // 2. Test Flex (T2I attempt - omitting inputs)
    await testModel("flux-2/flex-image-to-image", false);

    // 3. Test Flex (I2I Control - verify key works)
    await testModel("flux-2/flex-image-to-image", true);
}

runTests();
