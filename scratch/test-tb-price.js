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

        if (!res.ok) return null;
        const html = await res.text();

        const prices = [];
        const snippetPriceRegex = /(?:sold|price)[^\$]{0,30}\$([0-9]+\.[0-9]{2})|\$([0-9]+\.[0-9]{2})[^\$]{0,30}sold/gi;
        let match;
        while ((match = snippetPriceRegex.exec(html)) !== null) {
            const p = parseFloat(match[1] || match[2]);
            if (!isNaN(p) && p > 0.50 && p < 2500) {
                prices.push(p);
            }
        }
        console.log(`Prices for "${title} ${format}":`, prices);
    } catch (e) {
        console.error(e);
    }
}

fetchEbaySoldViaDDG('True Blood Season 1', 'DVD');
fetchEbaySoldViaDDG('True Blood', 'DVD');
