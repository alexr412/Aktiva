const puppeteer = require('puppeteer-core');

(async () => {
  const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console and errors
  page.on('console', msg => {
    const txt = msg.text();
    if (!txt.includes('Download the React DevTools') && !txt.includes('Fast Refresh')) {
      console.log('PAGE LOG:', txt);
    }
  });
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));

  const latitude = 52.03022;
  const longitude = 8.53247;
  await page.setGeolocation({ latitude, longitude });

  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:9002', ['geolocation']);

  console.log("Navigating to homepage with auth bypass...");
  await page.goto('http://localhost:9002/?bypass_auth=true', { waitUntil: 'networkidle2' });

  console.log("Waiting for feed to load...");
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  const feedDebugInfo = await page.evaluate(() => {
    return window.feedDebugInfo;
  });

  if (!feedDebugInfo) {
    console.error("Error: window.feedDebugInfo is undefined");
    await browser.close();
    return;
  }

  console.log("Total candidates in pool:", feedDebugInfo.length);
  
  const top20 = feedDebugInfo
    .filter(item => item.inFinalFeed && item.rankPosition <= 20)
    .sort((a, b) => a.rankPosition - b.rankPosition);

  console.log("\n=================== TOP 20 SPOTS ===================");
  console.table(top20.map(item => ({
    Pos: item.rankPosition,
    Name: item.name,
    Source: item.source,
    Primary: item.primaryCategory,
    Sub: item.subCategory,
    Score: (item.relevanceScore || item.finalScore || 0).toFixed(1),
    Penalty: item.qualityPenalty,
    Boost: item.activityBoost,
    Adjusted: typeof item.adjustedScore === 'number' ? item.adjustedScore.toFixed(1) : item.adjustedScore
  })));

  // Count distribution of subCategory in top 20
  const subDist = {};
  top20.forEach(item => {
    subDist[item.subCategory] = (subDist[item.subCategory] || 0) + 1;
  });
  console.log("\nSubCategory distribution in Top 20:");
  console.log(JSON.stringify(subDist, null, 2));

  // Count distribution of primaryCategory in top 20
  const primDist = {};
  top20.forEach(item => {
    primDist[item.primaryCategory] = (primDist[item.primaryCategory] || 0) + 1;
  });
  console.log("\nPrimaryCategory distribution in Top 20:");
  console.log(JSON.stringify(primDist, null, 2));

  // Print all details of The Strike and Kamera
  console.log("\n=================== THE STRIKE DEBUG INFO ===================");
  const strike = feedDebugInfo.find(item => item.name.toLowerCase().includes("strike"));
  console.log(JSON.stringify(strike, null, 2));

  console.log("\n=================== KAMERA DEBUG INFO ===================");
  const kamera = feedDebugInfo.find(item => item.name.toLowerCase().includes("kamera"));
  console.log(JSON.stringify(kamera, null, 2));

  await browser.close();
})();
