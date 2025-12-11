
const https = require('https');
require('dotenv').config({ path: '.env.local' });

async function createTask() {
    console.log('Creating Flux Task...');
    const payload = JSON.stringify({
        model: 'flux-2/flex-text-to-image',
        input: {
            prompt: "A simple red cube",
            aspect_ratio: "1:1",
            resolution: "2K"
        }
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.kie.ai',
            path: '/api/v1/jobs/createTask',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': payload.length
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                const json = JSON.parse(data);
                console.log('Create Response:', json);
                resolve(json.data.taskId);
            });
        });
        req.write(payload);
        req.end();
    });
}

async function pollTask(taskId) {
    console.log(`Polling ${taskId}...`);
    const options = {
        hostname: 'api.kie.ai',
        path: `/api/v1/jobs/recordInfo?taskId=${taskId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${process.env.KIE_API_KEY}` }
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                console.log('Poll Response:', data);
                resolve(JSON.parse(data));
            });
        });
        req.end();
    });
}

async function main() {
    const taskId = await createTask();
    if (!taskId) return;

    // Poll loop
    let attempts = 0;
    const interval = setInterval(async () => {
        attempts++;
        const res = await pollTask(taskId);
        if (res.data && res.data.state === 'success') {
            console.log('SUCCESS! Full Data:', JSON.stringify(res.data, null, 2));
            clearInterval(interval);
        } else if (res.data && res.data.state === 'failed') {
            console.log('FAILED');
            clearInterval(interval);
        } else {
            console.log(`Status: ${res.data?.state || 'Unknown'} (Attempt ${attempts})`);
        }
    }, 5000);
}

main();
