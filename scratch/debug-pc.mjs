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
const rawPrices = html.match(/\$[0-9]+\.[0-9]{2}/g);
console.log('Raw Prices from PC:', rawPrices ? rawPrices.slice(0, 5) : null);
