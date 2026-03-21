import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 1000)); // wait for AuthContext to resolve session
  
  const rootHtml = await page.$eval('#root', el => el.innerHTML).catch(() => 'ROOT NOT FOUND');
  console.log('ROOT innerHTML length:', rootHtml.length);
  if (rootHtml.includes('login') || rootHtml.includes('Entrar') || rootHtml.includes('Email') || rootHtml.length > 500) {
    console.log('SUCCESS: Page rendered successfully with content!');
  } else {
    console.log('FAIL: Page might be blank. Content:', rootHtml.substring(0, 100));
  }
  
  await browser.close();
})();
