const fetch = require('node-fetch');
const fs = require('fs');

async function checkEbayDom() {
  console.log('Testing desktop vs mobile user agents on eBay...');
  const query = 'The Crow VHS';
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1`;

  // Desktop UA
  const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  // Mobile UA
  const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';

  try {
    const resM = await fetch(url, { headers: { 'User-Agent': mobileUA } });
    const htmlM = await resM.text();
    fs.writeFileSync('./scratch/ebay_mobile.html', htmlM);
    console.log('Mobile response len:', htmlM.length, 'Status:', resM.status);

    // Search for price patterns in ebay_mobile.html
    const priceClasses = htmlM.match(/class="[^"]*price[^"]*"/gi);
    console.log('Mobile price classes found:', priceClasses ? Array.from(new Set(priceClasses)).slice(0, 10) : []);

    // Search for JSON embedding in ebay_mobile.html
    const jsonPrices = htmlM.match(/"price"\s*:\s*\{[^}]+\}/gi) || htmlM.match(/"value"\s*:\s*"[0-9.]+"/gi);
    console.log('Mobile JSON prices found:', jsonPrices ? jsonPrices.slice(0, 10) : []);
  } catch (e) {
    console.error('Error:', e);
  }
}

checkEbayDom();
