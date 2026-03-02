import { createVeoTask } from './src/lib/kie.js';
import process from 'process';

async function testVeo() {
    const payload = {
        taskType: 'IMAGE_TO_VIDEO',
        generationType: 'IMAGE_TO_VIDEO',
        model: 'veo3_fast',
        prompt: 'Transition from start to end',
        imageUrls: [
            'https://tempfile.redpandaai.co/kieai/127378/temp_uploads/Oasis_Nano_AR_04.png',
            'https://tempfile.redpandaai.co/kieai/127378/temp_uploads/Alien_in_the_body_bag.png'
        ],
        aspectRatio: '16:9',
        durationType: '5',
        enableTranslation: true,
        enableFallback: true
    };

    console.log("Sending payload:", JSON.stringify(payload, null, 2));

    try {
        const result = await createVeoTask(payload);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

testVeo();
