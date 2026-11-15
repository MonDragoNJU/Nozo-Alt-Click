const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const extensionPath = path.resolve(__dirname, '../../');

// A site that sends X-Frame-Options and refuses to be framed by default.
const BLOCKED_SITE = 'https://www.google.com/';

test.describe('Nozo Extension E2E', () => {
    let context;
    let page;

    test.beforeEach(async () => {
        // Launch browser with extension
        context = await chromium.launchPersistentContext('', {
            headless: false, // Extensions usually need headful (or xvfb in CI)
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`
            ]
        });
        // Wait for the extension service worker so its listeners are ready.
        if (context.serviceWorkers().length === 0) {
            await context.waitForEvent('serviceworker');
        }
        page = await context.newPage();
        await page.goto('https://example.com');
    });

    test.afterEach(async () => {
        await context.close();
    });

    async function addLink(href, id) {
        await page.evaluate(({ href, id }) => {
            const link = document.createElement('a');
            link.href = href;
            link.id = id;
            link.textContent = id;
            document.body.appendChild(link);
        }, { href, id });
        return page.locator(`#${id}`);
    }

    function frameFor(urlPart) {
        return page.frames().find((f) => f !== page.mainFrame() && f.url().includes(urlPart));
    }

    test('extension injects the overlay', async () => {
        await expect(page.locator('#nozo-overlay-container')).toBeAttached();
        await expect(page.locator('#nozo-drop-zone')).toHaveCount(0);
    });

    test('Alt + click on a link opens the modal without navigating', async () => {
        await page.locator('a').first().click({ modifiers: ['Alt'] });

        await expect(page.locator('#nozo-overlay-container')).toHaveClass(/visible/);
        await expect(page.locator('#nozo-iframe')).toHaveAttribute('src', /iana\.org/);
        expect(page.url()).toContain('example.com');
    });

    test('a plain click still navigates normally', async () => {
        await Promise.all([
            page.waitForURL(/iana\.org/),
            page.locator('a').first().click(),
        ]);
        await expect(page.locator('#nozo-overlay-container')).not.toHaveClass(/visible/);
    });

    test('Escape closes the modal', async () => {
        await page.locator('a').first().click({ modifiers: ['Alt'] });
        await expect(page.locator('#nozo-overlay-container')).toHaveClass(/visible/);

        await page.keyboard.press('Escape');
        await expect(page.locator('#nozo-overlay-container')).not.toHaveClass(/visible/);
        await expect(page.locator('#nozo-iframe')).toHaveAttribute('src', 'about:blank');
    });

    test('previewed site loads even if it sends X-Frame-Options', async () => {
        const link = await addLink(BLOCKED_SITE, 'blocked-link');
        await link.click({ modifiers: ['Alt'] });

        await expect(page.locator('#nozo-overlay-container')).toHaveClass(/visible/);
        await expect.poll(() => Boolean(frameFor('google.')), { timeout: 10000 }).toBe(true);
    });

    test('other iframes keep their X-Frame-Options protection', async () => {
        // A page-created iframe (no Alt + click) must still be blocked.
        await page.evaluate((src) => {
            const f = document.createElement('iframe');
            f.id = 'page-frame';
            f.src = src;
            document.body.appendChild(f);
        }, BLOCKED_SITE);

        await page.waitForTimeout(3000);
        expect(frameFor('google.')).toBeUndefined();
    });

    test('protection is restored after closing the preview', async () => {
        const link = await addLink(BLOCKED_SITE, 'blocked-link');
        await link.click({ modifiers: ['Alt'] });
        await expect.poll(() => Boolean(frameFor('google.')), { timeout: 10000 }).toBe(true);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(800); // close animation + rule removal

        await page.evaluate((src) => {
            const f = document.createElement('iframe');
            f.src = src;
            document.body.appendChild(f);
        }, BLOCKED_SITE);
        await page.waitForTimeout(3000);
        expect(frameFor('google.')).toBeUndefined();
    });
});
