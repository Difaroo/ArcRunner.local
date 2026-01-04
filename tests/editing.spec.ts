
import { test, expect } from '@playwright/test';

test.describe('ArcRunner Editing Logic', () => {

    test('should allow editing an Episode Clip', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('heading', { name: /ArcRunner/i })).toBeVisible();

        // Navigate to Episode/Clips View first
        await page.getByRole('button', { name: 'Episode' }).click();

        // 1. Add New Scene
        // Uses ActionToolbar generic add button for now (or improve ID there too later)
        const initialRowCount = await page.getByTestId('clip-row').count();
        // Use specific ID from ActionToolbar to avoid matching row "Add" buttons
        const addButton = page.getByTestId('add-button');
        await addButton.click();

        // 2. Wait for NEW Clip Row
        await expect(async () => {
            const count = await page.getByTestId('clip-row').count();
            expect(count).toBeGreaterThan(initialRowCount);
        }).toPass();

        // 2. Wait for ANY Clip Row
        const rows = page.getByTestId('clip-row');
        await expect(rows.first()).toBeVisible();
        const lastRow = rows.last();
        await lastRow.scrollIntoViewIfNeeded();

        // 3. Edit Character via ID
        const characterCell = lastRow.getByTestId('cell-character');
        await expect(characterCell).toBeVisible();

        // Debug: Click row first ensures focus
        await lastRow.click();
        await characterCell.click();

        // 4. Input
        const charInput = characterCell.locator('input').first();
        await expect(charInput).toBeVisible();

        const testCharName = `Hero_${Date.now()}`;
        await charInput.fill(testCharName);

        // 5. Save via ID
        const saveButton = lastRow.getByTestId('save-button');
        await expect(saveButton).toBeVisible();
        await saveButton.click();

        // 6. Verify
        await expect(charInput).not.toBeVisible();
        await expect(lastRow).toContainText(testCharName);
    });

    test('should allow editing a Studio Library Item', async ({ page }) => {
        await page.goto('/');

        // 1. Switch to Studio
        await page.getByRole('button', { name: 'Studio' }).click();

        // 2. Add Item
        const addButtons = page.getByRole('button').filter({ hasText: 'add' });
        await addButtons.last().click();

        // 3. Wait for Library Row
        const rows = page.getByTestId('library-row');
        await expect(rows.first()).toBeVisible();
        const lastRow = rows.last();
        lastRow.scrollIntoViewIfNeeded();

        // 4. Edit Name (Index 2 in table, but we use ID now)
        const nameCell = lastRow.getByTestId('cell-name');
        await nameCell.click();

        const nameInput = nameCell.locator('input').first();
        await expect(nameInput).toBeVisible();

        const testItemName = `Prop_${Date.now()}`;
        await nameInput.fill(testItemName);

        // 5. Save
        const saveButton = lastRow.getByTestId('save-button');
        await saveButton.click();

        // 6. Verify
        await expect(lastRow).toContainText(testItemName);
    });

});
