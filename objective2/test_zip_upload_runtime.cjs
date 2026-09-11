const path = require('path');
const puppeteer = require('./frontend/node_modules/puppeteer-core');

const ARTIFACTS_DIR = 'C:\\Users\\prana\\.gemini\\antigravity\\brain\\4c9022f2-fd9a-4c1a-a145-36900b84d7b8';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ZIP_PATH = path.resolve(__dirname, 'test_codebase.zip');

async function clickButtonWithText(page, text) {
  const success = await page.evaluate((targetText) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent && b.textContent.includes(targetText));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }, text);

  if (!success) {
    throw new Error(`Could not find button containing text: "${text}"`);
  }
}

async function run() {
  console.log('--- STARTING TRACEIQ ZIP UPLOAD RUNTIME VERIFICATION ---');
  console.log('Target URL: http://127.0.0.1:5174');
  console.log('ZIP Path:', ZIP_PATH);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  page.on('console', (msg) => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => console.error(`[Browser PageError] ${err.message}`));

  try {
    // 1. Initial Load
    await page.goto('http://127.0.0.1:5174', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));

    // Check title and header brand
    const brandText = await page.$eval('header h1', (el) => el.textContent.trim());
    console.log(`[Step 1] Header Brand Text: "${brandText}"`);
    if (!brandText.includes('TRACE') || !brandText.includes('IQ')) {
      throw new Error(`Expected header brand 'TRACEIQ' but got '${brandText}'`);
    }

    const initialNodes = await page.$$('.react-flow__node');
    console.log(`[Step 1] Initial Demo Nodes Rendered: ${initialNodes.length}`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'zip_test_1_initial.png') });

    // 2. Open Import Modal
    console.log('[Step 2] Clicking "Import" button in header...');
    await clickButtonWithText(page, 'Import');
    await new Promise((r) => setTimeout(r, 600));

    // Verify modal visible
    const modalTitle = await page.$eval('h3', (el) => el.textContent.trim());
    console.log(`[Step 2] Modal opened with title: "${modalTitle}"`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'zip_test_2_modal_opened.png') });

    // 3. Upload ZIP file
    console.log('[Step 3] Selecting ZIP file via input[type="file"]...');
    const fileInput = await page.waitForSelector('input[type="file"][accept=".zip"]', { timeout: 5000 });
    await fileInput.uploadFile(ZIP_PATH);
    await new Promise((r) => setTimeout(r, 600));

    // Verify file name display
    const selectedFileName = await page.$eval('div.border-dashed p.font-semibold', (el) => el.textContent.trim());
    console.log(`[Step 3] Displayed File Name: "${selectedFileName}"`);
    if (!selectedFileName.includes('test_codebase.zip')) {
      throw new Error(`Selected file name does not match: ${selectedFileName}`);
    }
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'zip_test_3_file_selected.png') });

    // 4. Click "Analyze Codebase"
    console.log('[Step 4] Clicking "Analyze Codebase" button...');
    await clickButtonWithText(page, 'Analyze Codebase');

    // 5. Wait for analysis & graph update
    console.log('[Step 5] Waiting for extraction and analysis pipeline to complete...');
    // Modal should close
    await page.waitForFunction(() => !document.querySelector('h3'), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Verify updated nodes count
    const updatedNodes = await page.$$('.react-flow__node');
    console.log(`[Step 5] Extracted Architecture Nodes Rendered: ${updatedNodes.length}`);
    if (updatedNodes.length < 15) {
      throw new Error(`Expected at least 15 extracted nodes but found ${updatedNodes.length}`);
    }
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'zip_test_4_extracted_graph.png') });

    // 6. Inspect an extracted service
    console.log('[Step 6] Clicking on an extracted service node to inspect metrics...');
    const orderNode = await page.evaluateHandle(() => {
      const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
      return nodes.find((n) => n.textContent.includes('Order Service') || n.textContent.includes('Auth Service')) || null;
    });

    if (orderNode && orderNode.asElement()) {
      await orderNode.asElement().click();
      await new Promise((r) => setTimeout(r, 800));

      const drawerTitle = await page.waitForSelector('div.border-l h3', { timeout: 5000 });
      const drawerText = await page.evaluate((el) => el.textContent.trim(), drawerTitle);
      console.log(`[Step 6] Component Drawer Opened for: "${drawerText}"`);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'zip_test_5_inspection_drawer.png') });

      // Close drawer
      const closeDrawerBtn = await page.$('div.border-l button');
      if (closeDrawerBtn) await closeDrawerBtn.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // 7. Switch to Risk & Triage View
    console.log('[Step 7] Switching to Risk & Triage view...');
    await clickButtonWithText(page, 'Risk & Triage');
    await new Promise((r) => setTimeout(r, 1200));

    // Verify triage components exist
    const criticalHeaders = await page.$$eval('h4', (els) => els.map((e) => e.textContent.trim()));
    console.log(`[Step 7] Triage sections: ${criticalHeaders.join(' | ')}`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'zip_test_6_triage_view.png') });

    // 8. Switch back to Graph View and test Sample button reset
    console.log('[Step 8] Switching back to Graph View and testing "Sample" button...');
    await clickButtonWithText(page, 'Graph View');
    await new Promise((r) => setTimeout(r, 800));

    await clickButtonWithText(page, 'Sample');
    await new Promise((r) => setTimeout(r, 1500));

    const restoredNodes = await page.$$('.react-flow__node');
    console.log(`[Step 8] Restored Demo Nodes: ${restoredNodes.length}`);
    if (restoredNodes.length !== 13) {
      throw new Error(`Expected 13 restored demo nodes but found ${restoredNodes.length}`);
    }
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'zip_test_7_restored_sample.png') });

    console.log('=== ALL RUNTIME CHECKS PASSED SUCCESSFULLY ===');
  } catch (err) {
    console.error('VERIFICATION FAILED:', err);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'zip_test_error.png') });
    throw err;
  } finally {
    await browser.close();
  }
}

run();
