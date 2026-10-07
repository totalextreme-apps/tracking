const { fetchEbaySoldViaDDG } = require('../lib/pricing.ts');
// Actually lib/pricing.ts is typescript, so I can't require it directly.
// I will write a simple node script to fetch from DDG and print the HTML.
const title = "The Crow";
const format = "VHS";
const query = `site:ebay.com/itm "Sold" "${title}" ${format}`;
const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    }
}).then(res => res.text()).then(html => {
    console.log(html.substring(0, 1000)); // print first 1000 chars to see if blocked
});
