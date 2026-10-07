const fetch = require('node-fetch');

async function testProxyEbay(proxyName, getProxyUrlFn) {
  const query = 'The Crow VHS';
  const targetUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1&_rss=1`;
  const url = getProxyUrlFn(targetUrl);
  
  console.log(`\n--- Testing ${proxyName} ---`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });
    console.log(`${proxyName} Status:`, res.status);
    const text = await res.text();
    console.log(`${proxyName} Text Length:`, text.length);
    const isBlocked = text.includes('Error Page') || text.includes('Security Measure') || text.includes('Pardon Our Interruption') || text.includes('CAPTCHA');
    console.log(`${proxyName} Is Blocked:`, isBlocked);
    
    if (res.status === 200 && !isBlocked) {
      const dollarMatches = text.match(/\$([0-9]+\.[0-9]{2})/g);
      console.log(`${proxyName} Sample Prices:`, dollarMatches ? Array.from(new Set(dollarMatches)).slice(0, 10) : []);
    }
  } catch (e) {
    console.error(`${proxyName} Error:`, e.message);
  }
}

async function main() {
  await testProxyEbay('AllOrigins Raw', u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`);
  await testProxyEbay('AllOrigins JSON', u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`);
  await testProxyEbay('CodeTabs Proxy', u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`);
  await testProxyEbay('CorsProxy.io', u => `https://corsproxy.io/?${encodeURIComponent(u)}`);
  await testProxyEbay('Cors.sh', u => `https://proxy.cors.sh/${u}`);
}

main();
