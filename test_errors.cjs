const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.log('PAGE_ERROR:', err.toString());
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE_ERROR:', msg.text());
    }
  });

  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
  console.log('DOM check done');
})();
