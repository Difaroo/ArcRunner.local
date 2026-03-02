

const apiKey = process.env.KIE_API_KEY;

// Just hit the endpoint directly
async function testUpload() {
    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // 1x1 png

    fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ base64Data, fileName: 'test.png', uploadPath: "temp_uploads" })
    })
        .then(res => res.json())
        .then(data => console.log("Upload response:", JSON.stringify(data, null, 2)))
        .catch(err => console.error("Error:", err));
}

testUpload();
