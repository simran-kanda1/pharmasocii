import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Go to the local page for the most recent event
  console.log('Navigating to listing detail page...');
  await page.goto('http://localhost:5173/listing/events/TerL1G98E4HNzFDbFLKo', {
    waitUntil: 'domcontentloaded'
  });
  
  // Wait a bit for Firestore fetch and state updates
  await page.waitForTimeout(3000);
  
  // Print page title
  const title = await page.title();
  console.log('Page Title:', title);
  
  // Get HTML of the location element
  const locationText = await page.locator('.flex.items-start.gap-3.bg-background\\/60').allTextContents();
  console.log('Found blocks with class bg-background/60:');
  locationText.forEach((txt, idx) => {
    console.log(`Block ${idx + 1}:`, txt.trim().replace(/\s+/g, ' '));
  });
  
  // Take a screenshot
  await page.screenshot({ path: '/Users/arinkhosla/Desktop/pharmasocii/scratch/listing_detail_screenshot.png' });
  console.log('Screenshot saved to scratch/listing_detail_screenshot.png');
  
  await browser.close();
}

run().catch(console.error);
