const puppeteer = require('puppeteer-core');

(async () => {
  const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console and errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));

  const latitude = 52.03022;
  const longitude = 8.53247;
  console.log(`Setting geolocation to Bielefeld (${latitude}, ${longitude})...`);
  await page.setGeolocation({ latitude, longitude });

  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:9002', ['geolocation']);

  console.log('Navigating to http://localhost:9002 ...');
  await page.goto('http://localhost:9002', { waitUntil: 'networkidle2' });

  console.log('Waiting for feed to load...');
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  console.log('Extracting window.feedDebugSummary...');
  const feedDebugSummary = await page.evaluate(() => {
    return window.feedDebugSummary;
  });
  console.log('DEBUG SUMMARY:', JSON.stringify(feedDebugSummary, null, 2));

  console.log('Extracting window.feedDebugInfo...');
  const feedDebugInfo = await page.evaluate(() => {
    return window.feedDebugInfo;
  });

  const data = feedDebugInfo || [];
  console.log('\n==================================================');
  console.log(`TOTAL CANDIDATES IN POOL: ${data.length}`);
  console.log('==================================================\n');

  if (data.length > 0) {
    // Print all candidates in pool
    console.log('ALL CANDIDATES:');
    console.table(data.map((d) => ({
      Id: d.id,
      Name: d.name,
      Source: d.source,
      PrimaryCategory: d.primaryCategory,
      SubCategory: d.subCategory,
      Score: typeof d.finalScore === 'number' ? d.finalScore.toFixed(2) : d.finalScore,
      Adjusted: typeof d.adjustedScore === 'number' ? d.adjustedScore.toFixed(2) : d.adjustedScore,
      Included: d.includedInCandidatePool,
      InFeed: d.inFinalFeed,
      Pos: d.rankPosition,
      ExclReason: d.excludedReason || 'None'
    })));
  }

  await browser.close();
})();
