const fetch = require('node-fetch');

async function testMethod1_EbayWeb() {
  console.log('--- Method 1: eBay direct with realistic Chrome desktop headers ---');
  const query = 'The Crow VHS';
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('HTML len:', html.length, 'Is Error Page:', html.includes('Error Page'));
    
    // Parse prices
    const itemPrices = [];
    const itemRegex = /class="s-item__price"[^>]*><span[^>]*>([^<]+)<\/span>|class="s-item__price"[^>]*>([^<]+)</gi;
    let match;
    while ((match = itemRegex.exec(html)) !== null) {
      const priceStr = match[1] || match[2];
      itemPrices.push(priceStr);
    }
    console.log('s-item__price matches:', itemPrices.slice(0, 10));
  } catch (e) {
    console.error('Error M1:', e.message);
  }
}

async function testMethod2_EbayMobile() {
  console.log('\n--- Method 2: eBay mobile site ---');
  const query = 'The Crow VHS';
  const url = `https://m.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('HTML len:', html.length, 'Is Error Page:', html.includes('Error Page'));
  } catch (e) {
    console.error('Error M2:', e.message);
  }
}

async function testMethod3_EbayRSS() {
  console.log('\n--- Method 3: eBay RSS feed ---');
  const query = 'The Crow VHS';
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1&_rss=1`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('RSS text len:', text.length);
    if (res.status === 200) {
      console.log('RSS preview:', text.slice(0, 500));
    }
  } catch (e) {
    console.error('Error M3:', e.message);
  }
}

async function testMethod4_CorsProxy() {
  console.log('\n--- Method 4: Free CORS / Scraper Proxies ---');
  const query = 'The Crow VHS';
  const targetUrl = encodeURIComponent(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1`);
  
  // Try api.allorigins.win
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${targetUrl}`);
    console.log('AllOrigins Status:', res.status);
    const data = await res.json();
    const html = data.contents;
    console.log('AllOrigins HTML len:', html?.length, 'Is Error:', html?.includes('Error Page'));
    if (html && !html.includes('Error Page')) {
      const prices = [];
      const regex = /\$([0-9]+\.[0-9]{2})/g;
      let m;
      while ((m = regex.exec(html)) !== null) prices.push(m[1]);
      console.log('Sample prices:', prices.slice(0, 10));
    }
  } catch (e) {
    console.error('Error AllOrigins:', e.message);
  }
}

async function main() {
  await testMethod1_EbayWeb();
  await testMethod2_EbayMobile();
  await testMethod3_EbayRSS();
  await testMethod4_CorsProxy();
}

main();
