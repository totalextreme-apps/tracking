const fetch = require('node-fetch');

// Copy parseEbayPrices and isShippingContext directly from lib/pricing.ts to test
function isShippingContext(text, index, matchedStr) {
    const textBefore = text.slice(0, index);
    const lastSeparatorBefore = Math.max(
        textBefore.lastIndexOf('.'),
        textBefore.lastIndexOf(';'),
        textBefore.lastIndexOf('|'),
        textBefore.lastIndexOf('\n'),
        textBefore.lastIndexOf('\r'),
        textBefore.lastIndexOf('\t'),
        textBefore.lastIndexOf('  ')
    );
    const segmentStart = lastSeparatorBefore === -1 ? 0 : lastSeparatorBefore + 1;

    const textAfter = text.slice(index + matchedStr.length);
    const firstSeparatorAfter = textAfter.search(/[\.;|\n\r\t]|\s{2}/);
    const segmentEnd = firstSeparatorAfter === -1 ? text.length : index + matchedStr.length + firstSeparatorAfter;

    const segment = text.slice(segmentStart, segmentEnd).toLowerCase();

    const contextBeforeMatch = text.slice(segmentStart, index).trim();
    if (contextBeforeMatch.endsWith('+')) {
        return true;
    }
    
    const shippingRegex = /\b(shipping|postage|delivery)\b/i;
    if (shippingRegex.test(segment)) {
        return true;
    }

    return false;
}

function parseEbayPrices(html) {
    const prices = [];
    const priceRegex = /class\s*=\s*["']([^"']*)(s-item__price|s-card__price|POSITIVE|text-positive|ITEM_PRICE)([^"']*)["'][^>]*>([\s\S]*?)<\/span>/gi;
    let match;

    while ((match = priceRegex.exec(html)) !== null) {
        const fullClass = (match[1] + match[2] + match[3]).toLowerCase();
        if (fullClass.includes('shipping') || fullClass.includes('logistics') || fullClass.includes('postage') || fullClass.includes('delivery')) {
            continue;
        }
        let priceText = match[4].replace(/<[^>]*>/g, '').trim();
        if (priceText.includes('to')) {
            priceText = priceText.split('to')[0].trim();
        }
        const cleanPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (!isNaN(cleanPrice) && cleanPrice > 0) {
            const matchIndex = match.index;
            if (isShippingContext(html, matchIndex, priceText)) {
                continue;
            }
            prices.push(cleanPrice);
        }
    }

    if (prices.length === 0) {
        const cleanText = html.replace(/<[^>]*>/g, ' ');
        const dollarRegex = /\$([0-9,]+\.[0-9]{2})/g;
        let looseMatch;
        while ((looseMatch = dollarRegex.exec(cleanText)) !== null) {
            const cleanPrice = parseFloat(looseMatch[1].replace(/,/g, ''));
            if (!isNaN(cleanPrice) && cleanPrice > 0) {
                const matchIndex = looseMatch.index;
                if (isShippingContext(cleanText, matchIndex, looseMatch[0])) {
                    continue;
                }
                prices.push(cleanPrice);
            }
        }
    }

    return prices;
}

async function test() {
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=The%20Crow%20VHS&LH_Complete=1&LH_Sold=1`;
  const res = await fetch(ebayUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });
  const html = await res.text();
  console.log('HTTP Status:', res.status);
  const prices = parseEbayPrices(html);
  console.log('Parsed prices on 403 response:', prices);
}

test();
