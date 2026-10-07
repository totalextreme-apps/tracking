const fetch = require('node-fetch');

async function testDuckDuckGo() {
  console.log('--- Testing DuckDuckGo HTML Search for eBay Sold prices ---');
  const query = 'site:ebay.com/itm "Sold" "The Crow" VHS';
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });
    console.log('DDG Status:', res.status);
    const html = await res.text();
    console.log('DDG HTML length:', html.length);
    const dollarMatches = html.match(/\$[0-9]+\.[0-9]{2}/g);
    console.log('Dollar matches in DDG results:', dollarMatches?.slice(0, 15));
  } catch (e) {
    console.error('DDG Error:', e);
  }
}

async function testEbayApiPublic() {
  console.log('\n--- Testing eBay Public Search Endpoints ---');
  // eBay mobile app / autocomplete / item search APIs
  const query = 'The Crow VHS';
  const url = `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findCompletedItems&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=eBay-App-PRD-12345678-12345678&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&keywords=${encodeURIComponent(query)}&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    console.log('eBay Finding Service API Status:', res.status);
    const text = await res.text();
    console.log('API Text len:', text.length, text.slice(0, 300));
  } catch (e) {
    console.error('eBay API Error:', e);
  }
}

async function main() {
  await testDuckDuckGo();
  await testEbayApiPublic();
}

main();
