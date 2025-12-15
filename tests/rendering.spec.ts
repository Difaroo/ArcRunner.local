
import { test, expect } from '@playwright/test';

test.describe('ArcRunner Rendering Flow', () => {

    test('Trigger Generation (UI -> API Handover)', async ({ page }) => {
        // 1. Go to home
        await page.goto('/');

        // Navigate to Episode/Clips View
        await page.getByRole('button', { name: 'Episode' }).click();

        // Wait for ANY table
        await expect(page.locator('table')).toBeVisible();

        // Log headers to see where we are
        const headers = await page.locator('th').allInnerTexts();
        console.log('Current Table Headers:', headers);

        // Check if we are truly on Clips view
        if (!headers.some(h => h.includes('SCN'))) {
            throw new Error(`Navigation failed? Expected SCN header, found: ${headers.join(', ')}`);
        }

        // 2. Select the first clip
        // Wait for table body
        await expect(page.locator('tbody')).toBeVisible();

        // Count rows to debug if data is actually there
        const rowCount = await page.locator('tbody tr').count();
        console.log(`Debug: Found ${rowCount} rows in the table.`);

        if (rowCount === 0) {
            throw new Error("Table is empty! Cannot test generation without clips.");
        }

        // Debug: Print HTML of first row to see why checkox isn't found
        const firstRowHtml = await page.locator('tbody tr').first().innerHTML();
        console.log('First Row HTML:', firstRowHtml);

        // Try strict selector for Radix Checkbox (Button in 2nd cell)
        const firstCheckbox = page.locator('tbody tr').first().locator('td').nth(1).locator('button');
        await expect(firstCheckbox).toBeVisible();
        await firstCheckbox.click();

        // 3. Setup API Interception to verify payload AND mock response
        let requestPayload: any = null;
        await page.route('/api/generate*', async route => {
            requestPayload = route.request().postDataJSON();
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    taskId: 'TEST_TASK_123',
                    resultUrl: 'https://via.placeholder.com/150', // Mock result
                    status: 'Generating'
                })
            });
        });

        // 4. Click Generate
        const generateButton = page.getByRole('button', { name: /Generate/i }).first();
        await expect(generateButton).toBeEnabled(); // Should enable after selection
        await generateButton.click();

        // 5. Verify Request Payload
        // We expect 'rowIndex' (which is now DB ID), 'clip', 'model', etc.
        // Waiting for the route handler to fire implies we need to wait for the action.
        // Playwright awaits generic actions, but route handling is async background.
        // We'll wait for the "Generating" status to appear, which implies the fetch completed.

        // 6. Verify UI Status Update
        // The table row should show "Generating" or similar.
        // Or checking the button state / toast.
        await expect(page.getByText(/Generating/i)).toBeVisible({ timeout: 5000 });

        console.log('Intercepted Payload:', requestPayload);

        // Assert payload structure
        expect(requestPayload).toBeTruthy();
        expect(requestPayload.clip).toBeDefined();
        // Critical key content check:
        // If migration worked, 'rowIndex' should be the ID.
        // Verify it exists.
        expect(requestPayload.rowIndex).toBeDefined();
    });

});
