const puppeteer = require('./frontend/node_modules/puppeteer-core');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function runBrowserTest() {
  const tmpProfile = path.join(os.tmpdir(), 'chrome_test_prof_' + Date.now());
  console.log('Using temp profile:', tmpProfile);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--user-data-dir=' + tmpProfile,
      '--window-size=1400,900',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]:`, text);
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
    console.error('[BROWSER PAGE ERROR]:', err.message);
  });

  page.on('requestfailed', (req) => {
    console.warn('[BROWSER REQUEST FAILED]:', req.url(), req.failure()?.errorText);
  });

  console.log('\n--- 1. Navigating to http://127.0.0.1:5174/ ---');
  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded', timeout: 15000 });

  console.log('\n--- 2. Checking Page Title and DOM Root ---');
  const title = await page.title();
  console.log('Page Title:', title);

  const rootHtml = await page.$eval('#root', (el) => el.innerHTML.slice(0, 300));
  console.log('Root HTML snippet:', rootHtml);

  // Wait 1.5 seconds for initial API calls (health & demo architecture)
  await new Promise((r) => setTimeout(r, 1500));

  // Check header branding
  const headerInfo = await page.evaluate(() => {
    const header = document.querySelector('header');
    const h1 = document.querySelector('header h1');
    const text = header ? header.innerText.replace(/\n+/g, ' | ') : 'NO_HEADER';
    const h1Text = h1 ? h1.innerText.trim() : '';
    return {
      fullText: text,
      h1Text,
      hasPrototype: text.includes('Prototype') || text.includes('Objective 2'),
      hasSubtitles: text.includes('/ Architecture Analysis') || text.includes('— Dependency Analysis'),
    };
  });
  console.log('Header Branding Info:', headerInfo);

  // Check background color of body to ensure light theme
  const bodyBgColor = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  console.log('Body Background Color:', bodyBgColor);

  // Count React Flow nodes
  const nodeCount = await page.evaluate(() => {
    return document.querySelectorAll('.react-flow__node').length;
  });
  console.log('React Flow Nodes rendered:', nodeCount);

  // Take initial screenshot
  const screenshotPath1 = path.join(__dirname, 'screenshot_step1_initial.png');
  await page.screenshot({ path: screenshotPath1 });
  console.log('Saved screenshot 1:', screenshotPath1);

  // 3. Test "Analyze" button click
  console.log('\n--- 3. Testing Analyze Button ---');
  const analyzeBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find((b) => b.innerText.trim() === 'Analyze' || b.innerText.includes('Analyzing'));
  });

  if (analyzeBtn && analyzeBtn.asElement()) {
    console.log('Clicking "Analyze"...');
    await analyzeBtn.asElement().click();
    // Wait for analysis API call to complete
    await new Promise((r) => setTimeout(r, 2000));

    // Check if bottom floating pill and node tags updated
    const statusPillText = await page.evaluate(() => {
      const el = document.querySelector('.bottom-4');
      return el ? el.innerText.replace(/\n+/g, ' ') : 'NOT_FOUND';
    });
    console.log('Bottom Status Pill:', statusPillText);

    const badgesFound = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasHighRisk: text.includes('High Risk') || text.includes('HIGH RISK'),
        hasSpof: text.includes('SPOF'),
        hasCycle: text.includes('CYCLE'),
      };
    });
    console.log('Tags found on canvas:', badgesFound);
  } else {
    console.warn('Could not find Analyze button!');
  }

  // Take screenshot after analysis
  const screenshotPath2 = path.join(__dirname, 'screenshot_step2_analyzed.png');
  await page.screenshot({ path: screenshotPath2 });
  console.log('Saved screenshot 2:', screenshotPath2);

  // 4. Test Node Inspection Drawer
  console.log('\n--- 4. Testing Node Inspection Drawer ---');
  const targetNode = await page.evaluate(() => {
    const el = document.querySelector('.react-flow__node h4');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { text: el.innerText, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  console.log('Target node for click:', targetNode);

  if (targetNode) {
    await page.mouse.click(targetNode.x, targetNode.y);
  } else {
    await page.click('.react-flow__node');
  }
  await new Promise((r) => setTimeout(r, 1000));

  const drawerState = await page.evaluate(() => {
    const drawer = document.querySelector('.w-84, .w-96');
    if (!drawer) return { isOpen: false };
    return {
      isOpen: true,
      text: drawer.innerText.slice(0, 180).replace(/\n+/g, ' '),
    };
  });
  console.log('Inspection Drawer state:', drawerState);

  // Click the "Why is this component...?" expandable
  const whyClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const whyBtn = btns.find((b) => b.innerText.toLowerCase().includes('why is this'));
    if (whyBtn) {
      whyBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked "Why?" expandable:', whyClicked);
  await new Promise((r) => setTimeout(r, 600));

  const screenshotPath3 = path.join(__dirname, 'screenshot_step3_drawer.png');
  await page.screenshot({ path: screenshotPath3 });
  console.log('Saved screenshot 3:', screenshotPath3);

  // Close drawer
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.w-84 button, .w-96 button');
    if (closeBtn) closeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // 5. Test JSON Import Modal
  console.log('\n--- 5. Testing JSON Import Modal ---');
  const importBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find((b) => b.innerText.includes('Import'));
  });
  if (importBtn && importBtn.asElement()) {
    await importBtn.asElement().click();
    await new Promise((r) => setTimeout(r, 600));
    const modalOpen = await page.evaluate(() => {
      return document.body.innerText.includes('Import Architecture Model');
    });
    console.log('JSON Import Modal opened:', modalOpen);

    // Close modal
    const cancelBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.innerText.includes('Cancel'));
    });
    if (cancelBtn && cancelBtn.asElement()) {
      await cancelBtn.asElement().click();
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // 6. Test Switch to Risk & Triage View
  console.log('\n--- 6. Testing Risk & Triage View ---');
  const triageBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find((b) => b.innerText.includes('Risk & Triage'));
  });

  if (triageBtn && triageBtn.asElement()) {
    console.log('Switching to Risk & Triage View...');
    await triageBtn.asElement().click();
    await new Promise((r) => setTimeout(r, 1000));

    const triageStats = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasArchitectureHealth: body.includes('Architecture Health'),
        hasComplexityRating: body.includes('COMPLEXITY'),
        hasDensity: body.includes('Density'),
        hasRankedComponents: body.includes('Ranked Critical Components'),
        hasSpofs: body.includes('Single Points of Failure'),
        hasCycles: body.includes('Circular Dependencies'),
        hasHighRiskDeps: body.includes('High-Risk Dependencies'),
      };
    });
    console.log('Risk & Triage sections found:', triageStats);

    // 7. Test "View all 7 SPOFs" Modal
    console.log('\n--- 7. Testing "View all SPOFs" Modal ---');
    const viewSpofsBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.innerText.includes('View all') && b.innerText.includes('SPOFs'));
    });

    if (viewSpofsBtn && viewSpofsBtn.asElement()) {
      await viewSpofsBtn.asElement().click();
      await new Promise((r) => setTimeout(r, 600));

      const spofModalStats = await page.evaluate(() => {
        const modal = document.querySelector('.max-w-2xl');
        if (!modal) return { isOpen: false };
        const text = modal.innerText;
        return {
          isOpen: true,
          title: text.includes('All Single Points of Failure'),
          countMentioned: text.includes('7 Detected'),
        };
      });
      console.log('All SPOFs Modal State:', spofModalStats);

      const screenshotPathSpofs = path.join(__dirname, 'screenshot_step5_spofs_modal.png');
      await page.screenshot({ path: screenshotPathSpofs });
      console.log('Saved SPOFs modal screenshot:', screenshotPathSpofs);

      // Close modal
      const closeSpofsBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('.max-w-2xl button'));
        return btns.find((b) => b.innerText.includes('Close') || b.querySelector('svg'));
      });
      if (closeSpofsBtn && closeSpofsBtn.asElement()) {
        await closeSpofsBtn.asElement().click();
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // 8. Test "View all 16 Dependencies" Modal
    console.log('\n--- 8. Testing "View all Dependencies" Modal ---');
    const viewDepsBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.innerText.includes('View all') && b.innerText.includes('dependencies'));
    });

    if (viewDepsBtn && viewDepsBtn.asElement()) {
      await viewDepsBtn.asElement().click();
      await new Promise((r) => setTimeout(r, 600));

      const depsModalStats = await page.evaluate(() => {
        const modal = document.querySelector('.max-w-3xl');
        if (!modal) return { isOpen: false };
        const rows = modal.querySelectorAll('tbody tr').length;
        const text = modal.innerText;
        return {
          isOpen: true,
          title: text.includes('All High-Risk Dependencies'),
          rowsRendered: rows,
        };
      });
      console.log('All Dependencies Modal State:', depsModalStats);

      const screenshotPathDeps = path.join(__dirname, 'screenshot_step6_deps_modal.png');
      await page.screenshot({ path: screenshotPathDeps });
      console.log('Saved Dependencies modal screenshot:', screenshotPathDeps);

      // Close modal
      const closeDepsBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('.max-w-3xl button'));
        return btns.find((b) => b.innerText.includes('Close') || b.querySelector('svg'));
      });
      if (closeDepsBtn && closeDepsBtn.asElement()) {
        await closeDepsBtn.asElement().click();
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  const screenshotPath4 = path.join(__dirname, 'screenshot_step4_triage.png');
  await page.screenshot({ path: screenshotPath4 });
  console.log('Saved screenshot 4:', screenshotPath4);

  console.log('\n--- Test Summary ---');
  console.log('Total Console Logs:', consoleLogs.length);
  console.log('Total Page Errors:', pageErrors.length);
  if (pageErrors.length > 0) {
    console.error('FAILED with page errors:', pageErrors);
  } else {
    console.log('SUCCESS: All browser runtime checks passed with 0 page errors!');
  }

  await browser.close();

  // Clean up tmp profile
  try {
    fs.rmSync(tmpProfile, { recursive: true, force: true });
  } catch (e) {}

  process.exit(pageErrors.length > 0 ? 1 : 0);
}

runBrowserTest().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
