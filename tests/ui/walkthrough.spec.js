import { chromium } from '/tmp/pos-design-validation/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

(async () => {
    const idsToFind = new Set(JSON.parse(fs.readFileSync('ids.json', 'utf8')));
    const foundIds = new Set();

    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
    const page = await context.newPage();

    async function recordIds() {
        const currentIds = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('[id]')).map(el => el.id);
        });
        currentIds.forEach(id => foundIds.add(id));
    }

    await page.goto('file:///home/dev/worktrees/tyt-pos-ui/pos.html');
    await page.waitForLoadState('networkidle');
    await recordIds();

    console.log("State 1: Order entry");
    await page.screenshot({ path: 'tests/ui/screenshots/1-order-entry.png' });

    console.log("State 2: Modifier sheet");
    // Open modifiers for multiple dishes to get all exclusions and options into DOM
    const dishes = ['dish-tom-yum', 'dish-tom-kha', 'dish-pad-thai', 'dish-pad-kee-mow', 'dish-thai-fried-rice', 'dish-basil-fried-rice'];
    for (const dish of dishes) {
        if (await page.isVisible(`#${dish}`)) {
            await page.click(`#${dish}`);
            await page.waitForSelector('#modifier-dialog[open]');
            await recordIds();
            if (dish === 'dish-tom-yum') {
                await page.screenshot({ path: 'tests/ui/screenshots/2-modifier-sheet.png' });
            }
            await page.click('#modifier-close');
            await page.waitForTimeout(100);
        }
    }

    // Now edit soup line specifically
    await page.click('#line-soup-edit');
    await page.waitForSelector('#modifier-dialog[open]');
    await recordIds();
    await page.click('#modifier-close');
    await page.waitForTimeout(100);


    console.log("State 3: Fired, printer outcome unknown");
    await page.click('#fire-order');
    await page.waitForSelector('#printer-dialog[open]');
    await recordIds();
    await page.screenshot({ path: 'tests/ui/screenshots/3-printer-unknown.png' });
    
    // Check reprint to get those IDs
    await page.check('#reprint-ack');
    await page.click('#printer-reprint');
    await recordIds();
    
    await page.click('#printer-done');

    console.log("State 4: Cash settlement and close");
    await page.click('#cash-open');
    await page.waitForSelector('#cash-dialog[open]');
    await recordIds();
    await page.screenshot({ path: 'tests/ui/screenshots/4-cash-settlement.png' });

    // Try an unsupported amount to get cash-error to show and exact amount
    await page.type('#cash-tendered', '12.34');
    await recordIds();

    await page.click('#cash-30');
    await recordIds();
    await page.click('#cash-review');
    await page.waitForSelector('#confirm-dialog[open]');
    await recordIds();
    
    await page.click('#confirm-ack');
    await page.click('#confirm-close-check');
    await page.waitForSelector('#closed-dialog[open]');
    await recordIds();
    await page.screenshot({ path: 'tests/ui/screenshots/5-closed.png' });

    await page.click('#closed-done');
    await recordIds();

    // Check if we found all IDs
    const missing = [];
    for (const id of idsToFind) {
        if (!foundIds.has(id)) {
            missing.push(id);
        }
    }

    if (missing.length > 0) {
        console.error("Missing IDs in DOM:", missing);
        process.exit(1);
    } else {
        console.log("All spec IDs successfully found in DOM during walkthrough.");
    }

    await browser.close();
})();
