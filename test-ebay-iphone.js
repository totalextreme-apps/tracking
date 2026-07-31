const title = 'Transformers';
const format = 'Blu-ray';
const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(title + ' ' + format)}&LH_Complete=1&LH_Sold=1`;
fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
}).then(async res => {
    console.log(res.status);
    const html = await res.text();
    const regex = /class="[^"]*(s-item__price|s-card__price)[^"]*">([\s\S]*?)<\/span>/g;
    const prices = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        prices.push(match[2]);
    }
    console.log('Prices found:', prices.length);
    if(prices.length === 0) console.log(html.slice(0, 1000));
}).catch(console.error);
