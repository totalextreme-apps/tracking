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
console.log(html.substring(0, 1000));
