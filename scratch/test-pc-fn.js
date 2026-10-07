const fetch = require('node-fetch');

async function fetchPriceChartingValue(title, format) {
  const formatSuffix = format === 'BluRay' ? 'Blu-ray' : format;
  const query = `${title} ${formatSuffix}`;
  const url = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=videogames`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) return null;
    const html = await res.text();

    const prices = [];
    // Match prices in PriceCharting tables (e.g. <span class="price..."> $15.00 </span> or class="price js-price"> $12.50 )
    const priceRegex = /class="[^"]*price[^"]*"[^>]*>\s*\$([0-9]+\.[0-9]{2})/gi;
    let match;
    while ((match = priceRegex.exec(html)) !== null) {
      const p = parseFloat(match[1]);
      if (!isNaN(p) && p > 0.50 && p < 2500 && p !== 5.39) {
        prices.push(p);
      }
    }

    if (prices.length === 0) return null;

    const validPrices = prices.filter(p => p >= 0.50 && p <= 2500.00);
    const sorted = [...validPrices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    return {
      value: parseFloat(median.toFixed(2)),
      source: 'pricecharting',
      pricesCount: validPrices.length
    };
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('Testing fetchPriceChartingValue...');
  console.log('The Crow VHS:', await fetchPriceChartingValue('The Crow', 'VHS'));
  console.log('Pulp Fiction VHS:', await fetchPriceChartingValue('Pulp Fiction', 'VHS'));
  console.log('Transformers Blu-ray:', await fetchPriceChartingValue('Transformers', 'Blu-ray'));
}

main();
