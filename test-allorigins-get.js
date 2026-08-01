const title = 'Transformers';
const format = 'Blu-ray';
const targetUrl = encodeURIComponent(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(title + ' ' + format)}&LH_Complete=1&LH_Sold=1`);
const proxyUrl = `https://api.allorigins.win/get?url=${targetUrl}`;

fetch(proxyUrl).then(async res => {
    console.log("Status:", res.status);
    const json = await res.json();
    const html = json.contents;
    const priceRegex = /class="[^"]*(s-item__price|s-card__price|POSITIVE|text-positive)[^"]*">([\s\S]*?)<\/span>/gi;
    const prices = [];
    let match;
    while ((match = priceRegex.exec(html)) !== null) {
        prices.push(match[2]);
    }
    console.log('Prices found:', prices.length);
}).catch(console.error);
