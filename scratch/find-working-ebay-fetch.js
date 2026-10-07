const fetch = require('node-fetch');

async function testEbayRssDirect() {
  console.log('--- Testing eBay RSS with mobile & desktop User-Agents ---');
  const title = 'Pulp Fiction';
  const format = 'VHS';
  const query = `${title} ${format}`;
  const rssUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1&_rss=1`;

  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'eBayiPhone/6.115.0 Mobile/15E148',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  ];

  for (const ua of uas) {
    try {
      const res = await fetch(rssUrl, {
        headers: {
          'User-Agent': ua,
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      console.log(`UA [${ua.slice(0, 30)}...] Status:`, res.status);
      if (res.status === 200) {
        const xml = await res.text();
        console.log('XML Len:', xml.length);
        const prices = xml.match(/\$[0-9]+\.[0-9]{2}/g);
        console.log('Prices in RSS:', prices ? prices.slice(0, 10) : []);
      }
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

async function testAllOriginsRaw() {
  console.log('\n--- Testing AllOrigins Raw RSS Proxy ---');
  const query = 'Pulp Fiction VHS';
  const targetUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1&_rss=1`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
  try {
    const res = await fetch(proxyUrl);
    console.log('AllOrigins Raw Status:', res.status);
    if (res.status === 200) {
      const text = await res.text();
      console.log('Text len:', text.length);
      const prices = text.match(/\$[0-9]+\.[0-9]{2}/g);
      console.log('Prices found:', prices ? Array.from(new Set(prices)).slice(0, 10) : []);
    }
  } catch (e) {
    console.error('AllOrigins Error:', e);
  }
}

async function testScraperProxy() {
  console.log('\n--- Testing Scraper Proxies ---');
  const query = 'The Crow VHS';
  const targetUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1`;
  
  // Try api.codetabs.com
  try {
    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);
    console.log('CodeTabs Status:', res.status);
    const html = await res.text();
    console.log('CodeTabs HTML len:', html.length);
    const priceRegex = /class="[^"]*(s-item__price|s-card__price)[^"]*">([\s\S]*?)<\/span>/gi;
    const prices = [];
    let match;
    while ((match = priceRegex.exec(html)) !== null) {
      const pStr = match[2].replace(/<[^>]*>/g, '').trim();
      const pVal = parseFloat(pStr.replace(/[^0-9.]/g, ''));
      if (!isNaN(pVal) && pVal > 0.50 && pVal < 2000 && pVal !== 5.39) prices.push(pVal);
    }
    console.log('CodeTabs Prices:', prices.slice(0, 10));
  } catch (e) {
    console.error('CodeTabs Error:', e);
  }
}

async function main() {
  await testEbayRssDirect();
  await testAllOriginsRaw();
  await testScraperProxy();
}

main();
