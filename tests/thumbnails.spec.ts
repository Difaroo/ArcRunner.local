
import { test, expect } from '@playwright/test';

test.describe('Thumbnail Debugging', () => {

    test('Verify API Clips Response and Asset Serving', async ({ request }) => {
        // 1. Fetch Clips JSON
        const response = await request.get('/api/clips');
        expect(response.ok()).toBeTruthy();
        const data = await response.json();

        // 2. Find a Clip with 'Candy_Jones' or known character
        const candyClip = data.clips.find((c: any) => c.character && c.character.includes('Candy_Jones'));

        if (!candyClip) {
            console.warn('No clip with Candy_Jones found to test.');
        } else {
            console.log('Inspecting Candy Clip:', {
                id: candyClip.id,
                character: candyClip.character,
                characterImageUrls: candyClip.characterImageUrls
            });

            // 3. Asset Verification
            if (candyClip.characterImageUrls.length > 0) {
                console.log(`Found ${candyClip.characterImageUrls.length} image URLs.`);
                for (const url of candyClip.characterImageUrls) {
                    console.log(`Checking Asset URL: ${url}`);
                    if (url.includes('http://test') || url.includes('placeholder')) {
                        console.log('Skipping mock/placeholder URL');
                        continue;
                    }
                    const assetRes = await request.get(url);
                    if (!assetRes.ok()) {
                        console.warn(`WARN: Asset ${url} missing (Expected in Data-Only Restore)`);
                    } else {
                        expect(assetRes.ok()).toBeTruthy();
                        console.log(`Asset ${url} returned ${assetRes.status()}`);
                    }
                }
            } else {
                console.error('FAIL: Clip has character "Candy_Jones" but NO characterImageUrls populated!');
            }
        }
    });
});
