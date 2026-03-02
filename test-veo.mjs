const apiKey = process.env.KIE_API_KEY;

if (!apiKey) {
    console.error("Missing KIE_API_KEY");
    process.exit(1);
}

const payload = {
    "model": "veo3_fast",
    "prompt": "Transition from start to end",
    "aspectRatio": "16:9",
    "durationType": "5",
    "enableTranslation": true,
    "enableFallback": false,
    "imageUrls": [
        "https://tempfile.redpandaai.co/kieai/127378/temp_uploads/Oasis_Nano_AR_04.png",
        "https://tempfile.redpandaai.co/kieai/127378/temp_uploads/Alien_in_the_body_bag.png"
    ],
    "generationType": "REFERENCE_2_VIDEO"
};

fetch('https://api.kie.ai/api/v1/veo/generate', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
})
    .then(res => res.json())
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(err => console.error(err));
