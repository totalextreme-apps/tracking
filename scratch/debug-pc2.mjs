const title = "The Crow";
const format = "VHS";
const query = `${title} ${format}`;
const url = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=videogames`;
const res = await fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    }
});
const html = await res.text();
const priceRegex = /class="[^"]*price[^"]*"[^>]*>\s*\$([0-9]+\.[0-9]{2})/gi;
const matches = [];
let match;
while ((match = priceRegex.exec(html)) !== null) {
    matches.push(parseFloat(match[1]));
}
console.log('Regex matches:', matches);

// Just print snippet of the first raw price
const rawMatch = html.match(/\$[0-9]+\.[0-9]{2}/);
if (rawMatch) {
    const idx = html.indexOf(rawMatch[0]);
    console.log('Snippet around first price:', html.substring(Math.max(0, idx - 50), idx + 50));
}
