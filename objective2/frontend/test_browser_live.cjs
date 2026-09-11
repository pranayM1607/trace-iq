const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testBrowser() {
  console.log('=== TRACEIQ OBJECTIVE 2 BROWSER RUNTIME DIAGNOSTIC ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[RUNTIME UNCAUGHT ERROR] ${err.toString()}`);
  });

  page.on('requestfailed', req => {
    console.error(`[REQUEST FAILED] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  console.log('1. Navigating to http://127.0.0.1:5174/ ...');
  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('2. Waiting for React to mount (#root > div)...');
  await page.waitForSelector('#root > div', { timeout: 20000 });
  console.log('React MOUNTED successfully!');

  // Wait 3 seconds for initial state & auto-analysis
  await new Promise(r => setTimeout(r, 3000));

  console.log('3. Inspecting rendered page contents...');
  const state = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.react-flow__node');
    const edges = document.querySelectorAll('.react-flow__edge');
    const headerTitle = document.querySelector('header h1')?.textContent;
    const subtitle = document.querySelector('header p')?.textContent;
    const bodyText = document.body.innerText;
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);

    return {
      headerTitle,
      subtitle,
      nodesCount: nodes.length,
      edgesCount: edges.length,
      buttons,
      hasOfflineBanner: bodyText.includes('offline') || bodyText.includes('Offline'),
      hasFailedBanner: bodyText.includes('Analysis failed'),
      bodySnippet: bodyText.slice(0, 350).replace(/\n+/g, ' | ')
    };
  });

  console.log('\n=== REAL BROWSER DIAGNOSTIC RESULTS ===');
  console.log(JSON.stringify(state, null, 2));

  await browser.close();
  console.log('\nDiagnostic completed cleanly.');
}

testBrowser().catch(err => {
  console.error('Diagnostic error:', err.message);
  process.exit(1);
});
