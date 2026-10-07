const title = "The Crow";
const format = "VHS";
const query = `site:ebay.com/itm "Sold" "${title}" ${format}`;
const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

const res = await fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    }
});
const html = await res.text();
const prices = [];
const snippetPriceRegex = /(?:sold|price)[^\$]{0,30}\$([0-9]+\.[0-9]{2})|\$([0-9]+\.[0-9]{2})[^\$]{0,30}sold/gi;
let match;
while ((match = snippetPriceRegex.exec(html)) !== null) {
    const p = parseFloat(match[1] || match[2]);
    prices.push(p);
}
console.log('Prices found:', prices);

// Search for any other $ signs to see what DDG actually returned
const rawPrices = html.match(/\$[0-9]+\.[0-9]{2}/g);
console.log('Raw Prices:', rawPrices);

if (rawPrices && prices.length === 0) {
    // print snippets around raw prices to debug regex
    for (const rawPrice of rawPrices) {
        const idx = html.indexOf(rawPrice);
        console.log('Snippet around', rawPrice, ':', html.substring(Math.max(0, idx - 50), idx + 50));
    }
}
