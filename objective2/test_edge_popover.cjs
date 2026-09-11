const puppeteer = require('./frontend/node_modules/puppeteer-core');
const path = require('path');
const os = require('os');

const ARTIFACT_DIR = 'C:\\Users\\prana\\.gemini\\antigravity\\brain\\4c9022f2-fd9a-4c1a-a145-36900b84d7b8';

async function testEdgeInspection() {
  const tmpProfile = path.join(os.tmpdir(), 'chrome_edge_test_' + Date.now());
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--user-data-dir=' + tmpProfile, '--window-size=1440,920'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 920 });

  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2000));

  // Find edge label pills
  const clickedBadge = await page.evaluate(() => {
    const badges = Array.from(document.querySelectorAll('[title*="Click to inspect dependency"]'));
    if (badges.length > 0) {
      badges[0].click();
      return { clicked: true, title: badges[0].getAttribute('title') };
    }
    return { clicked: false };
  });

  console.log('Clicked Edge Label Badge:', clickedBadge);
  await new Promise((r) => setTimeout(r, 800));

  const popoverInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasPopover: text.includes('Dependency Inspection'),
      hasRisk: text.includes('Risk Assessment'),
      snippet: text.slice(0, 400)
    };
  });

  console.log('Edge Popover Info:', JSON.stringify(popoverInfo, null, 2));
  const ssEdge = path.join(ARTIFACT_DIR, 'metric_test_edge_popover_verified.png');
  await page.screenshot({ path: ssEdge });
  console.log('Saved edge screenshot:', ssEdge);

  await browser.close();
}

testEdgeInspection().catch(console.error);
