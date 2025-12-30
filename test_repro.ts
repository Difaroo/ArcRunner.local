
import fs from 'fs';
import path from 'path';
import https from 'https';

// Parse .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
let KIE_API_KEY = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    KIE_API_KEY = envContent.split('\n')
        .find(line => line.startsWith('KIE_API_KEY='))
        ?.split('=')[1]
        ?.trim().replace(/^["']|["']$/g, '') || '';
} catch (e) {
    console.error("Could not read .env.local", e);
}

if (!KIE_API_KEY) {
    console.error("Could not find KIE_API_KEY");
    process.exit(1);
}

async function testPayload(name: string, payload: any) {
    console.log(`\n--- Testing ${name} ---`);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    return new Promise((resolve) => {
        const req = https.request("https://api.kie.ai/api/v1/jobs/createTask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${KIE_API_KEY}`
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log(`Response: ${body}`);
                resolve(null);
            });
        });

        req.on('error', e => console.error(e));
        req.write(JSON.stringify(payload));
        req.end();
    });
}

async function run() {
    // 1. Flex Text-to-Image (The Correct Model)
    await testPayload("Flex T2I (The Fix)", {
        model: "flux-2/flex-text-to-image",
        input: {
            prompt: "Test prompt T2I check",
            aspect_ratio: "16:9",
            resolution: "2K",
            disable_safety_checker: true
        }
    });

    // 2. Control (Object Input + NO URL - Fail)
    await testPayload("Control: Flex I2I No URL", {
        model: "flux-2/flex-image-to-image",
        input: {
            prompt: "Test prompt T2I check",
            aspect_ratio: "16:9",
            resolution: "2K",
            disable_safety_checker: true
        }
    });
}

run();
