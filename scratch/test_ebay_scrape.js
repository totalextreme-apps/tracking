async function test() {
    console.log('Testing fetch for Escape from New York VHS...');
    const url = 'https://www.ebay.com/sch/i.html?_nkw=Escape+from+New+York+VHS&LH_Complete=1&LH_Sold=1';
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });
    const html = await res.text();
    console.log('HTML length:', html.length);
    if (html.includes('5.39')) {
        console.log('HTML contains string 5.39!');
        let idx = 0;
        while ((idx = html.indexOf('5.39', idx)) !== -1) {
            console.log('Snippet:', html.slice(Math.max(0, idx - 100), Math.min(html.length, idx + 100)));
            idx += 4;
        }
    } else {
        console.log('HTML does NOT contain 5.39');
    }
}

test().catch(console.error);
