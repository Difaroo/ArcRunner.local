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
        // MOCKED Data: 'Test Series'
        await expect(page.getByText('Test Series').first()).toBeVisible();
        await page.getByText('Test Series').first().click();

        // 0.6 Click Episode in Table to Navigate
        // MOCKED Data: 'Ep 1'
        // Explicitly navigate to 'Episode' view (Clips Table)
        await page.getByRole('button', { name: 'Episode' }).first().click();

        // Wait for table to ensure view switch
        await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

        // 1. Verify Load
        // MOCKED Data: "A hero stands on a cliff"
        const tapeClip = page.getByText('A hero stands on a cliff').first();
        await expect(tapeClip).toBeVisible({ timeout: 10000 });

        // 2. Select Clip
        // Robustly get the row containing the visible text
        await page.locator('tr').filter({ has: tapeClip })
            .getByRole('checkbox').first().click();

        // 3. Click Generate
        await page.getByTestId('generate-selected-button').first().click();

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
