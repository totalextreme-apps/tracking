async function test() {
    const url = 'https://www.ebay.com/sch/i.html?_nkw=Clueless%20DVD&LH_Complete=1&LH_Sold=1';
    console.log('Fetching', url);
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });
    
    if (!response.ok) {
        console.error('Failed to fetch', response.status);
        return;
    }
    
    const html = await response.text();
    const priceRegex = /class="[^"]*(s-item__price|s-card__price)[^"]*">([\s\S]*?)<\/span>/g;
    
    console.log('Regex match count:', (html.match(priceRegex) || []).length);
    
    let match;
    const prices = [];
    while ((match = priceRegex.exec(html)) !== null) {
        let priceText = match[2].replace(/<[^>]*>/g, '').trim();
        if (priceText.includes('to')) {
            priceText = priceText.split('to')[0].trim();
        }
        const cleanPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (!isNaN(cleanPrice) && cleanPrice > 0) {
            prices.push(cleanPrice);
        }
    }
    
    console.log('Parsed prices:', prices);
}

test();
