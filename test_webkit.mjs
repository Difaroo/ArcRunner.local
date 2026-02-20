import { webkit } from 'playwright';

(async () => {
    try {
        const browser = await webkit.launch();
        const page = await browser.newPage();
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('http://localhost:3000/?seriesId=2&episodeId=1&view=clips', { waitUntil: 'networkidle' });

        await page.waitForTimeout(2000);

        const trailerBox = await page.evaluateHandle(() => {
            const rows = Array.from(document.querySelectorAll('div.flex.items-center'));
            return rows.find(r => r.textContent.includes('Trailer'));
        });
        if (trailerBox) await trailerBox.click();

        await page.waitForTimeout(1000);

        const pencils = await page.$$('button:has(svg.lucide-pencil)');
        if (pencils.length > 0) {
            await pencils[1].click();
        }

        await page.waitForTimeout(2000);

        const sizes = await page.evaluate(() => {
            const h3s = Array.from(document.querySelectorAll('h3'));
            const titleLabel = h3s.find(h => h.textContent.includes('VEO QUALITY') || h.textContent.includes('FLUX QUALITY'));
            if (!titleLabel) return { error: 'No title' };

            const outerWrap = titleLabel.closest('.border.border-stone-800');
            const flexRow = outerWrap.querySelector('.debug-port-verified');
            const cards = Array.from(flexRow.querySelectorAll('.bg-stone-900\\/40'));

            return {
                outerRect: outerWrap.getBoundingClientRect().width,
                flexRowRect: flexRow.getBoundingClientRect().width,
                cardsRect: cards.map(c => c.getBoundingClientRect().width),
                cardSum: cards.reduce((sum, c) => sum + c.getBoundingClientRect().width, 0)
            };
        });

        console.log(JSON.stringify(sizes, null, 2));
        await page.screenshot({ path: '/Users/davidfennell/.gemini/antigravity/brain/794c5c8c-e1bb-45f2-b649-dda251618fc6/webkit_render_test.png' });
        await browser.close();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
