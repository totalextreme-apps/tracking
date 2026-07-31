const title = 'Transformers';
const format = 'Blu-ray';
const targetUrl = encodeURIComponent(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(title + ' ' + format)}&LH_Complete=1&LH_Sold=1&_rss=1`);
const proxyUrl = `https://api.allorigins.win/raw?url=${targetUrl}`;

fetch(proxyUrl, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
}).then(async res => {
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Prices in text:", text.match(/\$[0-9]+\.[0-9]{2}/g)?.slice(0, 5));
}).catch(console.error);
