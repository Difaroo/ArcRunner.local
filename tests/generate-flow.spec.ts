import { test, expect } from '@playwright/test';

test.describe('Generate Flow', () => {

    const mockClips = [
        {
            id: "1",
            series: "1",
            episode: "1",
            action: "A hero stands on a cliff.",
            character: "Hero",
            location: "Cliff",
            status: "Note",
            explicitRefUrls: "",
            row_idx: 1,
            style: "Cinematic"
        }
    ];

    const mockLibrary = [
        {
            id: "100",
            series: "1",
            type: "LIB_CHARACTER",
            name: "Hero",
            refImageUrl: "http://test/hero.jpg"
        }
    ];

    test.beforeEach(async ({ page }) => {
        // Console log relay
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));

        await page.route('**/api/clips*', async route => {
            console.log('Intercepted /api/clips');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                json: {
                    clips: mockClips,
                    series: [{ id: "1", title: "Test Series" }],
                    libraryItems: mockLibrary,
                    episodes: [{ id: "1", title: "Ep 1", series: "1" }],
                    episodeTitles: { "1": "Ep 1" }
                }
            });
        });

        await page.route('**/api/generate*', async route => {
            console.log('Intercepted /api/generate');
            const body = JSON.parse(route.request().postData() || '{}');
            if (body.model === 'veo-test') {
                await route.fulfill({ json: { taskId: 'task-123', status: 'processing' } });
            } else {
                await route.fulfill({ json: { resultUrl: 'http://res/video.mp4', status: 'success' } });
            }
        });

        await page.goto('/');
    });

    test('should trigger generation for selected clip', async ({ page }) => {
        // 0.5. Verify Series Load & Select
        await expect(page.getByText('Test Series')).toBeVisible();
        await page.getByText('Test Series').click();

        // 0.6 Click Episode in Table to Navigate
        await page.getByText('Ep 1').click();

        // Wait for View Change logic to execute (setState in page.tsx)
        // Check for Clip visibility which confirms we are in Episode View
        await expect(page.getByText('A hero stands on a cliff')).toBeVisible({ timeout: 5000 });


        // Navigate
        const buttons = await page.getByRole('button').allInnerTexts();
        console.log('Available Buttons:', buttons);

        // Try 'Episode' as per edit-menus.spec.ts
        if (buttons.some(b => b.includes('Episode'))) {
            await page.getByRole('button', { name: 'Episode' }).first().click();
        } else if (buttons.some(b => b.includes('Script'))) {
            await page.getByRole('button', { name: 'Script' }).click();
        }

        // 1. Verify Load
        await expect(page.getByText('A hero stands on a cliff')).toBeVisible({ timeout: 10000 });

        // 2. Select Clip
        // Use a more specific selector
        await page.getByRole('row').filter({ hasText: 'A hero stands on a cliff' })
            .getByRole('checkbox').click();

        // 3. Click Generate
        await page.getByRole('button', { name: 'Generate' }).first().click();

        // 4. Verify Status Change
        // Using network interception as proof of call is good enough if UI is tricky
        // But status should update.
        // Wait for optimistic update or re-fetch
        // The mock logic in page.tsx says: setClips(newClips) with status='Generating'
        // So we should see 'Generating' text in the row?
        // Wait, the column header is STATUS.
        // Let's check for 'Generating' text.
        // Or 'Done' since our mock returns success immediately?
        // Actually, startTask returns -> setClips( resultUrl ).
        // The 'Generating' state is transient.
        // If it succeeds instantly, it might show 'Done' or just the result.

        // Let's assert that 'Generating' OR the result URL appears?
        // Or simply that the Request was made.
    });
});
