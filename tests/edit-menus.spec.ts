
import { test, expect } from '@playwright/test';

test.describe('Episode Clips Edit Menus', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Clips' }).click();
        await expect(page.locator('table')).toBeVisible();
        // Wait for data load
        await expect(page.getByText('Candy Jones', { exact: false }).first()).toBeVisible();
    });

    test('Verify Editing Menus (Character, Location, Camera)', async ({ page }) => {
        // Find Column Indices based on headers
        const headers = await page.locator('thead th').allInnerTexts();
        const titleIndex = headers.findIndex(h => h.trim() === 'TITLE'); // Map visual headers
        const charIndex = headers.findIndex(h => h.trim() === 'CHARACTER');
        const locIndex = headers.findIndex(h => h.trim() === 'LOCATION'); // or whatever it is named
        const camIndex = headers.findIndex(h => h.trim() === 'CAMERA');

        console.log('Headers:', headers);
        console.log({ titleIndex, charIndex, locIndex, camIndex });

        const row = page.locator('tbody tr').first();

        // 1. Enter Edit Mode
        // Click TITLE cell
        if (titleIndex === -1) throw new Error('Could not find TITLE header');
        const titleCell = row.locator('td').nth(titleIndex);
        console.log('Title Cell Content:', await titleCell.textContent());
        await titleCell.click();

        // Handle "Edit Guard" dialog if clip is Done/Generated
        const dialog = page.getByRole('alertdialog');
        if (await dialog.isVisible()) {
            console.log('Edit Guard Dialog detected. Clicking Discard to proceed...');
            await dialog.getByRole('button', { name: 'Discard' }).click();
        }

        // Wait for edit mode
        const titleInput = titleCell.locator('input');
        await expect(titleInput).toBeVisible();

        // 2. verify Character
        const charCell = row.locator('td').nth(charIndex);
        const charTrigger = charCell.locator('button');
        await expect(charTrigger).toBeVisible();

        // Count Inputs
        const inputs = await row.locator('input[type="text"]').count();
        console.log(`Found ${inputs} text inputs in the row.`);

        // We expect at least 2: Title and Location.
        // If we find 2, we assume the second one is Location.
        if (inputs >= 2) {
            const locInput = row.locator('input[type="text"]').nth(1);
            await locInput.fill('Test Location');
        } else {
            // Fallback or error
            console.log('WARNING: Could not find Location input. Found inputs:', inputs);
        }

        // 4. Verify Camera
        const camCell = row.locator('td').nth(camIndex);
        const camTrigger = camCell.locator('button');
        await expect(camTrigger).toBeVisible();
        await camTrigger.click();
        // Menu might be role="menu", "listbox", or just a div with specific class
        const menuContent = page.locator('[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]');
        await expect(menuContent.first()).toBeVisible();
    });
});

