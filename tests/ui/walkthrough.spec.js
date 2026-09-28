import { chromium } from '/tmp/pos-design-validation/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const shotsDir = path.join(__dirname, 'screenshots');

if (!fs.existsSync(shotsDir)) {
    fs.mkdirSync(shotsDir, { recursive: true });
}

// Minimal static HTTP server to serve rootDir
const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/pos.html';
    
    let filePath = path.join(rootDir, reqUrl);
    
    // Prevent directory traversal
    if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end();
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end();
            return;
        }
        res.writeHead(200);
        res.end(data);
    });
});

(async () => {
    // Start server
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const idsToFind = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'ids.json'), 'utf8')));
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

    await page.goto(`${baseUrl}/pos.html`);
    await page.waitForLoadState('networkidle');
    await recordIds();

    console.log("State 1: Order entry");
    await page.screenshot({ path: path.join(shotsDir, '1-order-entry.png') });

    console.log("State 2: Modifier sheet");
    // Open modifiers for multiple dishes to get all exclusions and options into DOM
    const dishes = ['dish-tom-yum', 'dish-tom-kha', 'dish-pad-thai', 'dish-pad-kee-mow', 'dish-thai-fried-rice', 'dish-basil-fried-rice'];
    for (const dish of dishes) {
        if (await page.isVisible(`#${dish}`)) {
            await page.click(`#${dish}`);
            await page.waitForSelector('#modifier-dialog[open]');
            await recordIds();
            if (dish === 'dish-tom-yum') {
                await page.screenshot({ path: path.join(shotsDir, '2-modifier-sheet.png') });
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
    await page.screenshot({ path: path.join(shotsDir, '3-printer-unknown.png') });
    
    // Check reprint to get those IDs
    await page.check('#reprint-ack');
    await page.click('#printer-reprint');
    await recordIds();
    
    await page.click('#printer-done');

    console.log("State 4: Cash settlement and close");
    await page.click('#cash-open');
    await page.waitForSelector('#cash-dialog[open]');
    await recordIds();
    await page.screenshot({ path: path.join(shotsDir, '4-cash-settlement.png') });

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
    await page.screenshot({ path: path.join(shotsDir, '5-closed.png') });

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
    server.close();
})();
