import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
    const taskId = 'f5b4b7293d82f35e2aa61adffe261368';
    const apiKey = process.env.KIE_API_KEY;
    const url = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;

    console.log(`Fetching from ${url}`);

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
