const puppeteer = require('./frontend/node_modules/puppeteer-core');
const path = require('path');
const os = require('os');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\prana\\.gemini\\antigravity\\brain\\4c9022f2-fd9a-4c1a-a145-36900b84d7b8';

async function testMetricExplanations() {
  const tmpProfile = path.join(os.tmpdir(), 'chrome_metrics_test_' + Date.now());
  console.log('Launching browser with profile:', tmpProfile);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--user-data-dir=' + tmpProfile,
      '--window-size=1440,920',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 920 });

  page.on('pageerror', (err) => {
    console.error('[PAGE ERROR]:', err.message);
  });

  console.log('\n--- 1. Navigating to TraceIQ frontend (port 5174) ---');
  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Search for order-service to select it specifically
  console.log('\n--- 2. Selecting Order Orchestration Service (SPOF) ---');
  const searchInput = await page.$('input[placeholder*="Search"]');
  if (searchInput) {
    await searchInput.type('Order Orchestration');
    await new Promise((r) => setTimeout(r, 800));
  }

  // Verify Drawer opened for Order Service
  const orderDrawerInfo = await page.evaluate(() => {
    const drawer = document.querySelector('.w-84, .sm\\:w-96');
    if (!drawer) return { open: false };
    const text = drawer.innerText;
    return {
      open: true,
      title: drawer.querySelector('h3')?.innerText || '',
      inDegree: text.match(/In-degree[\s\S]*?(\d+)/)?.[1],
      directDependents: text.match(/Direct Dependents[\s\S]*?(\d+)/)?.[1],
      outDegree: text.match(/Out-degree[\s\S]*?(\d+)/)?.[1],
      isSpof: text.includes('Single Point of Failure'),
      hasHighlightBtn: text.includes('Highlight Affected Paths'),
      blastRadius: text.match(/Failure Blast Radius[\s\S]*?(\d+\s*components?)/)?.[1],
      downstreamDepth: text.match(/Downstream Dependency Depth[\s\S]*?(\d+\s*tiers?)/)?.[1],
      upstreamDepth: text.match(/Upstream Failure Propagation Depth[\s\S]*?(\d+\s*tiers?)/)?.[1],
    };
  });
  console.log('Order Service Drawer Info:', JSON.stringify(orderDrawerInfo, null, 2));

  const ssOrderDrawer = path.join(ARTIFACT_DIR, 'metric_test_spof_order_service_drawer.png');
  await page.screenshot({ path: ssOrderDrawer });
  console.log('Saved SPOF Drawer screenshot:', ssOrderDrawer);

  // 3. Test Betweenness Centrality Expansion on Order Service
  console.log('\n--- 3. Testing Betweenness Centrality on Order Service ---');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bBtn = btns.find((b) => b.innerText.includes('Betweenness'));
    if (bBtn) bBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const ssBetweenness = path.join(ARTIFACT_DIR, 'metric_test_betweenness_paths.png');
  await page.screenshot({ path: ssBetweenness });
  console.log('Saved Betweenness expansion screenshot:', ssBetweenness);

  // 4. Test SPOF "Highlight Affected Paths"
  console.log('\n--- 4. Testing SPOF Path Highlighting on Canvas ---');
  const clickedHighlight = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => b.innerText.includes('Highlight Affected Paths'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Highlight Affected Paths:', clickedHighlight);
  await new Promise((r) => setTimeout(r, 800));

  const ssHighlightPaths = path.join(ARTIFACT_DIR, 'metric_test_spof_paths_highlighted_active.png');
  await page.screenshot({ path: ssHighlightPaths });
  console.log('Saved SPOF Paths Active screenshot:', ssHighlightPaths);

  // Clear highlight
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const clearBtn = btns.find((b) => b.innerText.includes('Clear Path Highlight') || b.innerText.trim() === 'Clear');
    if (clearBtn) clearBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // 5. Switch to Risk & Triage View
  console.log('\n--- 5. Switching to Risk & Triage View ---');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('header button'));
    const triageBtn = buttons.find((b) => b.innerText.includes('Risk & Triage'));
    if (triageBtn) triageBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Click Help on TraceIQ Cyclomatic Score
  console.log('\n--- 6. Opening TraceIQ Architectural Cyclomatic Score Modal ---');
  await page.evaluate(() => {
    const helpBtn = document.querySelector('button[title*="TraceIQ Architectural Cyclomatic Score"]');
    if (helpBtn) {
      helpBtn.click();
    } else {
      // Fallback
      const cards = Array.from(document.querySelectorAll('.bg-slate-50.p-3.rounded-xl'));
      for (const card of cards) {
        if (card.innerText.toLowerCase().includes('cyclomatic')) {
          const btn = card.querySelector('button');
          if (btn) { btn.click(); break; }
        }
      }
    }
  });
  await new Promise((r) => setTimeout(r, 600));

  const ssCycloModal = path.join(ARTIFACT_DIR, 'metric_test_cyclomatic_formula_modal.png');
  await page.screenshot({ path: ssCycloModal });
  console.log('Saved Cyclomatic Formula Modal screenshot:', ssCycloModal);

  // 7. Click Density Tab in Modal
  console.log('\n--- 7. Testing Density Tab in Modal ---');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.fixed button'));
    const densityTab = tabs.find((b) => b.innerText.trim() === 'Density');
    if (densityTab) densityTab.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  const ssDensityModal = path.join(ARTIFACT_DIR, 'metric_test_density_formula_modal.png');
  await page.screenshot({ path: ssDensityModal });
  console.log('Saved Density Modal screenshot:', ssDensityModal);

  // 8. Click SPOFs Tab in Modal
  console.log('\n--- 8. Testing SPOFs Tab in Modal ---');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.fixed button'));
    const spofsTab = tabs.find((b) => b.innerText.includes('SPOFs'));
    if (spofsTab) spofsTab.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  const ssSpofModal = path.join(ARTIFACT_DIR, 'metric_test_spofs_explanation_modal.png');
  await page.screenshot({ path: ssSpofModal });
  console.log('Saved SPOFs Modal screenshot:', ssSpofModal);

  // 9. Click Cycles Tab in Modal
  console.log('\n--- 9. Testing Cycles Tab in Modal ---');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.fixed button'));
    const cyclesTab = tabs.find((b) => b.innerText.includes('Cycles'));
    if (cyclesTab) cyclesTab.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  const ssCyclesModal = path.join(ARTIFACT_DIR, 'metric_test_cycles_explanation_modal.png');
  await page.screenshot({ path: ssCyclesModal });
  console.log('Saved Cycles Modal screenshot:', ssCyclesModal);

  console.log('\n--- ALL VERIFICATION RUNS COMPLETED ---');
  await browser.close();
}

testMetricExplanations().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
