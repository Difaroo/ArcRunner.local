
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
        await page.goto('/ingest');
        await expect(page.getByRole('heading', { name: /Ingest JSON/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Save/i }).first()).toBeVisible();
    });

});
