const fetch = require('node-fetch');

async function testDDGQuery(queryName, queryStr) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(queryStr)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const html = await res.text();
    console.log(`\n--- Query: [${queryName}] ---`);
    console.log('URL:', url);
    console.log('Status:', res.status, 'HTML len:', html.length);
    
    // Look for prices in snippets
    const prices = [];
    const dollarRegex = /\$([0-9]+\.[0-9]{2})/g;
    let m;
    while ((m = dollarRegex.exec(html)) !== null) {
      const p = parseFloat(m[1]);
      if (p > 0.50 && p < 2000 && p !== 5.39) prices.push(p);
    }
    console.log('Dollar matches found:', prices.slice(0, 10));
  } catch (e) {
    console.error('Error:', e);
  }
}

async function main() {
  await testDDGQuery('Query 1: site:ebay.com', 'site:ebay.com "The Crow" VHS sold');
  await testDDGQuery('Query 2: ebay price', 'ebay "The Crow" VHS sold price');
  await testDDGQuery('Query 3: ebay sold price', 'ebay sold price "The Crow" VHS');
  await testDDGQuery('Query 4: pricecharting', 'pricecharting "The Crow" VHS');
}

main();
