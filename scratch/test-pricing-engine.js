const fetch = require('node-fetch');

/**
 * Checks if HTML text is an eBay error/challenge page
 */
function isEbayErrorPage(html) {
  if (!html) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes('error page | ebay') ||
    lower.includes('security measure') ||
    lower.includes('pardon our interruption') ||
    lower.includes('captcha') ||
    lower.includes('sec-cpt') ||
    lower.includes('please verify yourself')
  );
}

/**
 * Enhanced eBay price parser that avoids $5.39 shipping trap
 */
function parseEbayPricesEnhanced(html) {
  if (isEbayErrorPage(html)) {
    return [];
  }

  const prices = [];

  // 1. Match HTML CSS Price Containers (Desktop & Mobile)
  const priceRegex = /class\s*=\s*["']([^"']*)(s-item__price|s-card__price|s-item__detail--primary|POSITIVE|text-positive|ITEM_PRICE)([^"']*)["'][^>]*>([\s\S]*?)<\/span>/gi;
  let match;

  while ((match = priceRegex.exec(html)) !== null) {
    const fullClass = (match[1] + match[2] + match[3]).toLowerCase();

    // Ignore shipping/postage/delivery spans
    if (fullClass.includes('shipping') || fullClass.includes('logistics') || fullClass.includes('postage') || fullClass.includes('delivery')) {
      continue;
    }

    let priceText = match[4].replace(/<[^>]*>/g, '').trim();

    // Range handling: e.g. "$10.00 to $15.00" -> "$10.00"
    if (priceText.includes('to')) {
      priceText = priceText.split('to')[0].trim();
    }

    const cleanPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    if (!isNaN(cleanPrice) && cleanPrice > 0.50 && cleanPrice < 2500) {
      // Exclude exact 5.39 if it's suspicious, or keep if inside valid class
      prices.push(cleanPrice);
    }
  }

  // 2. Match Embedded JSON Price Objects (frequently present in mobile/Firecrawl script tags)
  if (prices.length === 0) {
    const jsonPriceRegex = /"convertedItemPrice"\s*:\s*\{\s*"value"\s*:\s*"([0-9.]+)"|"price"\s*:\s*\{\s*"value"\s*:\s*"([0-9.]+)"/gi;
    let jsonMatch;
    while ((jsonMatch = jsonPriceRegex.exec(html)) !== null) {
      const p = parseFloat(jsonMatch[1] || jsonMatch[2]);
      if (!isNaN(p) && p > 0.50 && p < 2500) {
        prices.push(p);
      }
    }
  }

  // 3. Fallback for raw text / Firecrawl Markdown: Match explicit item sold price patterns ONLY
  if (prices.length === 0) {
    // Explicit pattern: "Sold $XX.XX" or "Sold for $XX.XX" or "$XX.XX Free shipping"
    const explicitSoldRegex = /(?:sold|price)[^\$]{0,20}\$([0-9]+\.[0-9]{2})|\$([0-9]+\.[0-9]{2})[^\$]{0,20}(?:free shipping|sold)/gi;
    let expMatch;
    while ((expMatch = explicitSoldRegex.exec(html)) !== null) {
      const p = parseFloat(expMatch[1] || expMatch[2]);
      if (!isNaN(p) && p > 0.50 && p < 2500 && p !== 5.39) {
        prices.push(p);
      }
    }
  }

  // Filter out any isolated 5.39 values if prices array contains mostly other values or only 5.39
  // (5.39 is almost universally eBay's standard media mail shipping price for tapes/discs)
  const nonShippingPrices = prices.filter(p => p !== 5.39);
  return nonShippingPrices.length > 0 ? nonShippingPrices : [];
}

/**
 * DuckDuckGo Search Fallback for eBay Sold Items
 */
async function fetchEbaySoldViaDDG(title, format, edition) {
  const formatSuffix = format === 'BluRay' ? 'Blu-ray' : format;
  const editionPart = edition ? ` ${edition}` : '';
  const query = `site:ebay.com/itm "Sold" "${title}" ${editionPart} ${formatSuffix}`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) return null;
    const html = await res.text();

    const prices = [];
    // Extract price patterns from DuckDuckGo search result snippets
    const snippetPriceRegex = /(?:sold|price)[^\$]{0,25}\$([0-9]+\.[0-9]{2})|\$([0-9]+\.[0-9]{2})[^\$]{0,25}sold/gi;
    let match;
    while ((match = snippetPriceRegex.exec(html)) !== null) {
      const p = parseFloat(match[1] || match[2]);
      if (!isNaN(p) && p > 0.50 && p < 2000 && p !== 5.39) {
        prices.push(p);
      }
    }

    if (prices.length === 0) return null;

    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    return {
      value: parseFloat(median.toFixed(2)),
      source: 'ddg-ebay-search',
      pricesCount: prices.length
    };
  } catch (e) {
    return null;
  }
}

async function testEngine() {
  console.log('Testing Enhanced Pricing Engine...');
  const testItems = [
    { title: 'The Crow', format: 'VHS' },
    { title: 'Hannibal', format: 'VHS' },
    { title: 'The Natural', format: 'VHS' },
    { title: 'Pulp Fiction', format: 'VHS' },
    { title: 'Desperado', format: 'VHS' }
  ];

  for (const item of testItems) {
    const ddgRes = await fetchEbaySoldViaDDG(item.title, item.format);
    console.log(`[DDG Fallback] "${item.title}" (${item.format}) =>`, ddgRes);
  }
}

testEngine();
