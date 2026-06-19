import { calculateMedianPrice, parseEbayPrices } from '../../lib/pricing';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const search = url.searchParams.get('s');

    if (!search) {
        return Response.json({ error: 'Missing search query' }, { status: 400 });
    }

    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(search)}&LH_Complete=1&LH_Sold=1`;
    let prices: number[] = [];
    let source = 'firecrawl-success';

    // Skip direct query on Vercel completely since cloud/datacenter IPs are 100% blocked by Akamai WAF.
    // Going straight to Firecrawl saves 15-20 seconds of direct timeout delays.
    try {
        console.log(`Scraping eBay completed values for "${search}" via Firecrawl HTML...`);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (process.env.FIRECRAWL_API_KEY) {
            headers['Authorization'] = `Bearer ${process.env.FIRECRAWL_API_KEY}`;
        }

        const firecrawlRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                url: ebayUrl,
                formats: ['html'],
                blockAds: true,
                removeBase64Images: true
            })
        });

        if (firecrawlRes.ok) {
            const firecrawlData = await firecrawlRes.json();
            if (firecrawlData.success && firecrawlData.data?.html) {
                const html = firecrawlData.data.html;
                prices = parseEbayPrices(html);
            } else {
                console.error('Firecrawl response success is false or missing html:', firecrawlData);
                source = 'firecrawl-no-data';
            }
        } else {
            console.error(`Firecrawl response error status: ${firecrawlRes.status}`);
            source = 'firecrawl-request-failed';
        }
    } catch (err) {
        console.error('Firecrawl scrape request threw error:', err);
        source = 'firecrawl-exception';
    }

    const median = calculateMedianPrice(prices);

    return Response.json({
        value: median,
        pricesCount: prices.length,
        source
    });
}

