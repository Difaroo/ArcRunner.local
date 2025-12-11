
const https = require('https');
require('dotenv').config({ path: '.env.local' });

async function testPayload(name, inputOverride) {
    console.log(`Testing payload: ${name}`);

    // Base valid(ish) payload
    const payload = JSON.stringify({
        model: 'flux-2/pro-image-to-image',
        input: {
            prompt: "A test prompt",
            aspect_ratio: "16:9",
            strength: 0.75,
            resolution: "2K",
            ...inputOverride
        }
    });

    const options = {
        hostname: 'api.kie.ai',
        path: '/api/v1/jobs/createTask',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
            'Content-Type': 'application/json',
            'Content-Length': payload.length
        }
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log('Response:', data);
                resolve();
            });
        });
        req.on('error', e => console.error(e));
        req.write(payload);
        req.end();
    });
}

async function main() {
    // 1. Google Drive Viewer link (HTML, not image)
    await testPayload('Drive Viewer Link', {
        input_urls: ["https://drive.google.com/file/d/1234567890abcdef/view?usp=sharing"]
    });

    // 2. Empty Array (Shouldn't happen in code but good to check)
    // await testPayload('Empty Array', { input_urls: [] });

    // 3. Non-existent URL
    // await testPayload('404 URL', { input_urls: ["https://google.com/nonexistent.png"] });
}

main();
