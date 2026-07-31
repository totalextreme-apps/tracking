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
    console.log("Status:", res.status);
    const html = await res.text();
    if(res.status !== 200) {
        console.log("Failed to fetch 200 OK. Try a different proxy/network.");
        return;
    }
    
    // Let's look for anything with "price" in the class or similar
    const priceMatches = html.match(/<span[^>]*price[^>]*>([\s\S]*?)<\/span>/gi);
    if(priceMatches) {
        console.log("Found general price matches:", priceMatches.slice(0, 5));
    } else {
        console.log("No price spans found!");
    }
}).catch(console.error);
