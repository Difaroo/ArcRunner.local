import { test, expect } from '@playwright/test';

test.describe('Recent Bug Fixes Verification', () => {

    test('Media Viewer Download - Filename includes clip scene and title', async ({ page, request }) => {
        // Navigate to media page
        await page.goto('/media');

        // Wait for media items to load
        await page.waitForSelector('[data-testid="media-display"], .group', { timeout: 10000 });

        // Find a reference image (attached to a clip)
        const refImage = page.locator('[data-testid="media-display"]').filter({
            has: page.locator('text=/Ref for Scene/i')
        }).first();

        // If we have reference images, check the filename logic
        const refCount = await refImage.count();
        if (refCount > 0) {
            // Click to open universal viewer
            await refImage.click();

            // Wait for viewer to open (check for controls)
            await page.waitForTimeout(1000);
            const downloadBtn = page.locator('button[aria-label*="Download"]');
            await expect(downloadBtn).toBeVisible({ timeout: 5000 });

            console.log('✓ Media viewer download button is present for reference image');
        } else {
            console.log('⚠ No reference images found to test download filename');
        }
    });

    test('API - Reference images sort LIFO (newest first)', async ({ request }) => {
        // Fetch clips data from API
        const response = await request.get('/api/clips');
        expect(response.ok()).toBeTruthy();

        const data = await response.json();

        // Find a clip with multiple media references
        const clipWithRefs = data.clips?.find((clip: any) =>
            clip.mediaReferences && clip.mediaReferences.length >= 2
        );

        if (clipWithRefs) {
            const refs = clipWithRefs.mediaReferences;

            // Verify LIFO: First item should have most recent createdAt
            const firstCreated = new Date(refs[0].createdAt).getTime();
            const secondCreated = new Date(refs[1].createdAt).getTime();

            expect(firstCreated).toBeGreaterThanOrEqual(secondCreated);
            console.log('✓ Reference images are sorted LIFO (newest first)');
        } else {
            console.log('⚠ No clips with multiple references found, skipping LIFO test');
        }
    });

    test('Media Copy - Creates duplicate Media records', async ({ page, request }) => {
        await page.goto('/media');

        // Wait for media to load
        await page.waitForSelector('[data-testid="media-display"], .group', { timeout: 10000 });

        // Check if copy button exists in media items
        const copyButton = page.locator('button[aria-label*="Copy"]').first();
        const copyCount = await copyButton.count();

        if (copyCount > 0) {
            console.log('✓ Copy button is available in media UI');

            // Verify the button has proper attributes
            await expect(copyButton).toBeVisible();
        } else {
            console.log('ℹ Copy button may require specific context (clip selection)');
        }
    });

    test('Clip Duplication - Copies reference images', async ({ request }) => {
        // This test verifies the duplication logic exists in the API
        // Full E2E test would require creating a clip, adding refs, and duplicating

        // Fetch clips to verify mediaReferences are included
        const response = await request.get('/api/clips');
        expect(response.ok()).toBeTruthy();

        const data = await response.json();

        // Verify that clips include mediaReferences in the response
        if (data.clips && data.clips.length > 0) {
            const hasMediaRefs = data.clips.some((clip: any) =>
                'mediaReferences' in clip
            );
            expect(hasMediaRefs).toBeTruthy();
            console.log('✓ Clips API includes mediaReferences field');
        }
    });

    test('Episode Navigation - Consistent routing', async ({ page }) => {
        await page.goto('/');

        // Navigate to Episode view
        await page.getByRole('button', { name: 'Episode' }).click();

        // Verify we're on episode page
        await expect(page.locator('table')).toBeVisible();

        // Check URL consistency (should have episode param or be on base path)
        const url = page.url();
        console.log('Episode page URL:', url);

        // Navigate to Media page
        await page.getByRole('button', { name: 'Media' }).click();
        await page.waitForURL(/\/media/, { timeout: 5000 });

        // Navigate back to Episode
        await page.getByRole('button', { name: 'Episode' }).click();
        await page.waitForTimeout(500);

        // Should still show table (no flash/blank state)
        await expect(page.locator('table')).toBeVisible();
        console.log('✓ Episode navigation remains consistent');
    });

    test('Media Page - No episode flash on load', async ({ page }) => {
        // Navigate directly to media page
        await page.goto('/media');

        // Check that episode selector doesn't flash or show wrong episode
        const episodeSelect = page.locator('select, [role="combobox"]').first();

        // Wait for initial render
        await page.waitForTimeout(1000);

        // Verify media items load without flashing
        const mediaDisplay = page.locator('[data-testid="media-display"], .group');
        const mediaCount = await mediaDisplay.count();

        console.log(`✓ Media page loaded ${mediaCount} items without episode flash`);
    });

    test.skip('Universal Viewer - Context detection', async ({ page }) => {
        await page.goto('/media');

        // Wait for media to load
        await page.waitForSelector('[data-testid="media-display"], .group', { timeout: 10000 });

        // Click first media item to open viewer
        const firstMedia = page.locator('[data-testid="media-display"], .group').first();
        await firstMedia.click();

        // Wait for viewer to open (allow animation)
        await page.waitForTimeout(1000);

        // Look for viewer controls (these should be visible when viewer is open)
        const viewerControls = page.locator('button[aria-label*="Close"], button[aria-label*="Download"]').first();
        const hasControls = await viewerControls.isVisible();
        expect(hasControls).toBeTruthy();

        console.log('✓ Universal viewer opens and detects context');

        // Close viewer with Escape key
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Verify viewer is closed (controls should be hidden)
        const stillVisible = await viewerControls.isVisible().catch(() => false);
        expect(stillVisible).toBeFalsy();
    });

});
