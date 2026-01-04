
import { test, expect } from '@playwright/test';

test.describe('ArcRunner Light Touch Smoke Test', () => {

    test('1. Data Load', async ({ page }) => {
        // Go to home and wait for main container
        await page.goto('/');

        // Wait for Series View (default) to load or ensure we are on it
        // Check that at least one "Series" button is visible or the series page header
        // Check for Logo text
        // Relaxing exact match due to whitespace in span
        // Check for Logo text within header to avoid matching loading states
        await expect(page.locator('header').getByText('ArcRunner', { exact: false })).toBeVisible();

        // Ensure Sync button is visible
        await expect(page.getByRole('button').filter({ hasText: 'sync' }).first()).toBeVisible();
    });

    test('2. Ingest Interaction', async ({ page }) => {
        // Clear local storage to prevent "Saved" state from hiding placeholder
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        // Navigate to Script View using the Header Button
        await page.getByRole('button', { name: 'Script' }).click();

        // Verify Textarea exists
        const textarea = page.getByPlaceholder(/{ "clips": \[ ... \], "library": \[ ... \] }/);
        await expect(textarea).toBeVisible();

        // Verify "Load Studio" button is initially present (enabled/disabled logic might vary, but button should be there)
        const loadButton = page.getByRole('button', { name: /Load Studio & Episode Data/i });
        await expect(loadButton).toBeVisible();

        // Type dummy text
        await textarea.fill('{"check": "enabled"}');

        // Button should still be visible/enabled (it only disables on click/loading)
        await expect(loadButton).toBeEnabled();
    });

    test('3. Navigation Switch', async ({ page }) => {
        await page.goto('/');

        // Default view is Series. 
        // Switch to "Library" (Studio)
        await page.getByRole('button', { name: 'Studio' }).click();

        // Check header changed or specific Library element appeared
        // LibraryTable usually has headers like "Type", "Name"
        await expect(page.getByRole('button', { name: 'Studio' })).toHaveClass(/bg-stone-800/); // Active class check

        // Switch back to "Clips"
        await page.getByRole('button', { name: 'Clips' }).click();

        // Wait specifically for the table to render
        // Attempt to find ANY clip row or the table itself
        await expect(page.locator('table')).toBeVisible();
    });

});
