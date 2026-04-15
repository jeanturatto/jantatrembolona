const puppeteer = require('puppeteer');
const http = require('http');

(async () => {
    // wait a moment in case dev server is still starting
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    let errorFound = false;

    page.on('pageerror', err => {
        console.log('PAGE_ERROR_DETECTED:', err.toString());
        errorFound = true;
    });
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('CONSOLE_ERROR_DETECTED:', msg.text());
            errorFound = true;
        }
    });

    console.log("Navigating to app...");
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    
    console.log("Injecting mock auth state into localStorage so it bypasses login...");
    await page.evaluate(() => {
        localStorage.setItem('sb-wlypysswdtsokmftttau-auth-token', JSON.stringify({
           access_token: 'fake_token',
           user: { id: 'fake_id', email: 'test@test.com' }
        }));
    });

    console.log("Reloading so user is logged in...");
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2' });
    
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();

    console.log('DONE. Found error: ' + errorFound);
    process.exit(0);
})();
