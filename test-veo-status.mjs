const apiKey = process.env.KIE_API_KEY;

if (!apiKey) {
    console.error("Missing KIE_API_KEY");
    process.exit(1);
}

const taskId = '475650d5798005e26629c9a33a819a5f';

fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${apiKey}`
    }
})
    .then(res => res.json())
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(err => console.error(err));
