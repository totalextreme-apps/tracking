const title = 'Transformers';
const format = 'Blu-ray';
const targetUrl = encodeURIComponent(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(title + ' ' + format)}&LH_Complete=1&LH_Sold=1`);
const proxyUrl = `https://translate.google.com/translate?sl=en&tl=en&u=${targetUrl}`;

fetch(proxyUrl, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
}).then(async res => {
    console.log("Status:", res.status);
    const html = await res.text();
    const priceRegex = /class="[^"]*(s-item__price|s-card__price|POSITIVE|text-positive)[^"]*">([\s\S]*?)<\/span>/gi;
    const prices = [];
    let match;
    while ((match = priceRegex.exec(html)) !== null) {
        prices.push(match[2]);
    }
    console.log('Prices found:', prices.length);
    if(prices.length === 0) console.log(html.slice(0, 500));
}).catch(console.error);
