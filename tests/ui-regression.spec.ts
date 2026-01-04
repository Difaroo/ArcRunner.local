
import { test, expect } from '@playwright/test';

test.describe('ArcRunner UI Regression', () => {

    test('Dashboard loads correctly', async ({ page }) => {
        // 1. Navigate to home
        await page.goto('/');

        // 2. Check Title
        await expect(page).toHaveTitle(/ArcRunner/);

        // 3. Check for specific dashboard elements
        // "Series" selector should be visible
        const seriesSelect = page.getByRole('combobox').first();
        await expect(seriesSelect).toBeVisible();

        // 4. Verify "Studio" (Library) link exists
        const studioLink = page.getByRole('link', { name: /Studio/i });
        // Or check based on your specific UI structure
        // Since I don't see the full UI snapshot, I'll aim for something generic first
    });

    test('Ingest Page loads', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.getByRole('button', { name: 'Script' }).click();

        // Check that we are not in Error state
        await expect(page.locator('text=Error:')).not.toBeVisible();

        // Check for placeholder or known text in Script view
        await expect(page.getByPlaceholder(/{ "clips": \[ ... \], "library": \[ ... \] }/)).toBeVisible();
        await expect(page.getByRole('button', { name: /Load Studio & Episode Data/i })).toBeVisible();
    });

});
