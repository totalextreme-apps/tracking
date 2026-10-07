const fetch = require('node-fetch');

async function testProxy(name, getUrlFn) {
  const query = 'The Crow VHS';
  const targetUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1`;
  const url = getUrlFn(targetUrl);
  
  console.log(`\n--- Testing ${name} ---`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });
    console.log(`${name} Status:`, res.status);
    const html = await res.text();
    console.log(`${name} Length:`, html.length, 'Is Error Page:', html.includes('Error Page') || html.includes('Security Measure') || html.includes('Pardon Our Interruption'));
    
    if (res.status === 200 && !html.includes('Error Page') && !html.includes('Security Measure')) {
      const priceRegex = /class="[^"]*(s-item__price|s-card__price|POSITIVE|text-positive)[^"]*">([\s\S]*?)<\/span>/gi;
      const prices = [];
      let match;
      while ((match = priceRegex.exec(html)) !== null) {
        const pStr = match[2].replace(/<[^>]*>/g, '').trim();
        const pVal = parseFloat(pStr.replace(/[^0-9.]/g, ''));
        if (!isNaN(pVal) && pVal > 0) prices.push(pVal);
      }
      console.log(`${name} Prices Found:`, prices.length, prices.slice(0, 10));
    }
  } catch (e) {
    console.error(`${name} Error:`, e.message);
  }
}

async function main() {
  await testProxy('CodeTabs', u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`);
  await testProxy('CorsProxy.io', u => `https://corsproxy.io/?${encodeURIComponent(u)}`);
  await testProxy('ScraperAPI free / htmlproxy', u => `https://htmlproxy.fyre.workers.dev/?url=${encodeURIComponent(u)}`);
  await testProxy('Thingproxy', u => `https://thingproxy.freeboard.io/fetch/${u}`);
}

main();
