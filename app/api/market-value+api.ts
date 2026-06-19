import { parseEbayPrices, calculateMedianPrice } from '../../lib/pricing';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const search = url.searchParams.get('s');

    if (!search) {
        return Response.json({ error: 'Missing search query' }, { status: 400 });
    }

    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(search)}&LH_Complete=1&LH_Sold=1`;

    try {
        const response = await fetch(ebayUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!response.ok) {
            return Response.json({ 
                value: null, 
                error: `eBay returned status: ${response.status}`, 
                source: 'ebay-api-failed' 
            });
        }

        const html = await response.text();
        const prices = parseEbayPrices(html);
        const median = calculateMedianPrice(prices);

        return Response.json({
            value: median,
            pricesCount: prices.length,
            source: 'ebay-api-success'
        });

    } catch (error) {
        console.error('eBay market-value API error:', error);
        return Response.json({ 
            value: null, 
            error: (error as Error).message, 
            source: 'ebay-api-error' 
        }, { status: 500 });
    }
}
