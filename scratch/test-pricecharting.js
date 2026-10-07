const fetch = require('node-fetch');

async function testPriceCharting(title, format) {
  console.log(`\n--- Testing PriceCharting for "${title}" (${format}) ---`);
  const query = `${title} ${format}`;
  const url = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=videogames`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });
    console.log('PriceCharting Status:', res.status);
    const html = await res.text();
    console.log('HTML Len:', html.length);
    
    // Look for prices in pricecharting tables
    const priceMatches = html.match(/class="price[^"]*"[^>]*>\s*\$([0-9]+\.[0-9]{2})/gi) || html.match(/\$([0-9]+\.[0-9]{2})/g);
    console.log('Price matches:', priceMatches ? Array.from(new Set(priceMatches)).slice(0, 10) : []);
  } catch (e) {
    console.error('PriceCharting error:', e);
  }
}

async function main() {
  await testPriceCharting('The Crow', 'VHS');
  await testPriceCharting('Pulp Fiction', 'VHS');
  await testPriceCharting('Transformers', 'Blu-ray');
}

main();
