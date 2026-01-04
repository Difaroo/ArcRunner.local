
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
        // 3. Setup API Interception to verify payload AND mock response

        // Count rows to debug if data is actually there
        const rows = page.getByTestId('clip-row');
        await expect(rows.first()).toBeVisible();

        // Select first checkbox
        const firstRow = rows.first();
        const checkbox = firstRow.getByRole('checkbox').first();
        await checkbox.click();
        await expect(checkbox).toBeChecked();

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
        const generateButton = page.getByTestId('generate-selected-button');
        await expect(generateButton).toBeEnabled(); // Should enable after selection
        await generateButton.click();

        // Handle Confirmation Dialog
        const confirmButton = page.getByRole('button', { name: /Confirm Generation/i });
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        // 5. Verify Request Payload
        // We expect 'rowIndex' (which is now DB ID), 'clip', 'model', etc.
        // Waiting for the route handler to fire implies we need to wait for the action.
        // Playwright awaits generic actions, but route handling is async background.
        // We'll wait for the "Generating" status to appear, which implies the fetch completed.

        // 6. Verify UI Status Update
        // The table row should show "Generating" or similar.
        // Or checking the button state / toast.
        // Verify UI State Change (Button should disappear/disable or show loading)
        // Since RowActions replaces the button with a spinner or hides it:
        // 6. Verify Request Payload Captured
        // We wait for the request to be intercepted.
        await expect.poll(() => requestPayload, { timeout: 5000 }).toBeTruthy();

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
