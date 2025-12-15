
const { spawn } = require('child_process');

async function main() {
    console.log('Verifying API /api/clips...');

    // Running against localhost:3000 (User has dev server running)
    const fetch = (await import('node-fetch')).default;

    try {
        const res = await fetch('http://localhost:3000/api/clips');
        if (!res.ok) throw new Error(`Status ${res.status}`);

        const data = await res.json();
        console.log(`Fetched ${data.clips?.length} clips.`);

        // Check Clip 58 (Known Ep 2)
        const clip58 = data.clips.find(c => c.id === '58');
        if (clip58) {
            console.log('Clip 58 (Ep 2):', {
                id: clip58.id,
                episode: clip58.episode,
                series: clip58.series,
                scene: clip58.scene
            });
        } else {
            console.log('Clip 58 NOT FOUND in API response!');
        }

        // Check Clip 91 (Known Ep 1)
        const clip91 = data.clips.find(c => c.id === '91');
        if (clip91) {
            console.log('Clip 91 (Ep 1):', {
                id: clip91.id,
                episode: clip91.episode,
                series: clip91.series,
                scene: clip91.scene
            });
        }

        // Count frequency of episodes
        const epCounts = {};
        data.clips.forEach(c => {
            epCounts[c.episode] = (epCounts[c.episode] || 0) + 1;
        });
        console.log('API Episode Frequency:', epCounts);

    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

main();
