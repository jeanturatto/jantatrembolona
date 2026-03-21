import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => fs.appendFileSync('page_logs.txt', 'LOG: ' + msg.text() + '\n'));
  page.on('pageerror', error => fs.appendFileSync('page_logs.txt', 'ERROR: ' + error.message + '\n'));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  
  const rootContent = await page.$eval('#root', el => el.innerHTML).catch(() => 'ROOT NOT FOUND');
  fs.writeFileSync('root_content.html', rootContent);
  
  await browser.close();
})();
