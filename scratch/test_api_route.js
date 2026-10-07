async function fetchEbaySoldViaDDG(title, format) {
    try {
        const query = `site:ebay.com/itm "Sold" "${title}" ${format}`;
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!res.ok) {
            console.log('DDG res not ok:', res.status);
            return null;
        }
        const html = await res.text();
        console.log('DDG HTML length:', html.length);

        const prices = [];
        // Test snippetPriceRegex
        const snippetPriceRegex = /(?:sold|price)[^\$]{0,30}\$([0-9]+\.[0-9]{2})|\$([0-9]+\.[0-9]{2})[^\$]{0,30}sold/gi;
        let match;
        while ((match = snippetPriceRegex.exec(html)) !== null) {
            console.log('Regex match:', match[0], 'Group1:', match[1], 'Group2:', match[2]);
            const p = parseFloat(match[1] || match[2]);
            if (!isNaN(p) && p > 0.50 && p < 2500) {
                prices.push(p);
            }
        }

        console.log('Prices found in DDG HTML:', prices);

        // Also search raw HTML for any occurrences of price patterns in DDG snippets:
        const allPricesRegex = /\$([0-9]+\.[0-9]{2})/gi;
        const allPrices = [];
        let pMatch;
        while ((pMatch = allPricesRegex.exec(html)) !== null) {
            const val = parseFloat(pMatch[1]);
            const idx = pMatch.index;
            const snippet = html.slice(Math.max(0, idx - 50), Math.min(html.length, idx + 50));
            allPrices.push({ val, snippet });
        }
        console.log('All dollar values in DDG snippets:', allPrices);
    } catch (e) {
        console.error('DDG error:', e);
    }
}

fetchEbaySoldViaDDG('Escape from new york', 'VHS');
