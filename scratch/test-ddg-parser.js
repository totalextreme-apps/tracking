const fetch = require('node-fetch');

async function searchEbaySoldPricesDDG(title, format) {
  const query = `site:ebay.com/itm "Sold" "${title}" ${format}`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!res.ok) return { prices: [], median: null, count: 0 };
    
    const html = await res.text();
    
    // Extract snippets from DuckDuckGo search result links/snippets
    // DDG result snippets contain snippets like: "Sold - $14.99 - ...", "Sold for $8.50 ...", "Item sold for $12.00"
    const prices = [];
    
    // Match patterns in DDG snippets:
    // 1. "Sold ... $XX.XX" or "Sold for $XX.XX" or "$XX.XX ... Sold"
    const soldRegex = /sold[^\$]{0,30}\$([0-9]+\.[0-9]{2})|\$([0-9]+\.[0-9]{2})[^\$]{0,30}sold/gi;
    let match;
    while ((match = soldRegex.exec(html)) !== null) {
      const priceVal = parseFloat(match[1] || match[2]);
      if (!isNaN(priceVal) && priceVal > 0.50 && priceVal < 2000) {
        prices.push(priceVal);
      }
    }
    
    // If no prices matched the "sold" regex specifically, extract prices from ebay.com/itm snippet texts
    if (prices.length === 0) {
      const snippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/span>/gi;
      let snippetMatch;
      while ((snippetMatch = snippetRegex.exec(html)) !== null) {
        const snippet = snippetMatch[1] || snippetMatch[2];
        const dollarMatch = snippet.match(/\$([0-9]+\.[0-9]{2})/g);
        if (dollarMatch) {
          dollarMatch.forEach(dm => {
            const p = parseFloat(dm.replace('$', ''));
            if (!isNaN(p) && p > 0.50 && p < 2000 && p !== 5.39) {
              prices.push(p);
            }
          });
        }
      }
    }
    
    // Filter out potential shipping costs or common non-item price artifacts if needed
    const validPrices = prices.filter(p => p !== 5.39); // extra safety against 5.39 shipping fee!

    if (validPrices.length === 0) return { prices: [], median: null, count: 0 };

    const sorted = [...validPrices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    return { prices: validPrices, median: parseFloat(median.toFixed(2)), count: validPrices.length };
  } catch (e) {
    console.error('DDG Error:', e);
    return { prices: [], median: null, count: 0 };
  }
}

async function testMultiple() {
  const testItems = [
    { title: 'The Crow', format: 'VHS' },
    { title: 'Hannibal', format: 'VHS' },
    { title: 'The Natural', format: 'VHS' },
    { title: 'Transformers', format: 'Blu-ray' },
    { title: 'Pulp Fiction', format: 'VHS' },
    { title: 'Cleopatra', format: 'VHS' },
    { title: 'Home Alone 2: Lost in New York', format: 'VHS' }
  ];

  for (const item of testItems) {
    const res = await searchEbaySoldPricesDDG(item.title, item.format);
    console.log(`"${item.title}" (${item.format}) => Median: $${res.median} (Count: ${res.count}, Prices: [${res.prices.join(', ')}])`);
  }
}

testMultiple();
