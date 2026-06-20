import { calculateMedianPrice, parseEbayPrices } from '../../lib/pricing';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const search = url.searchParams.get('s');

    if (!search) {
        return Response.json({ error: 'Missing search query' }, { status: 400 });
    }

    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(search)}&LH_Complete=1&LH_Sold=1`;
    let prices: number[] = [];
    let source = 'ebay-direct';
    let directOk = false;

    const userApiKey = request.headers.get('x-firecrawl-api-key') || '';

    // 1. Try a direct HTTP query to eBay first (works on residential IPs like local dev, and bypasses Firecrawl limits)
    try {
        console.log(`Attempting direct eBay scrape for "${search}"...`);
        const response = await fetch(ebayUrl, {
            signal: AbortSignal.timeout(1500),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (response.ok) {
            const html = await response.text();
            prices = parseEbayPrices(html);
            if (prices.length > 0) {
                directOk = true;
                console.log(`Direct scrape succeeded for "${search}": found ${prices.length} prices`);
            }
        } else {
            console.log(`Direct scrape returned status: ${response.status}`);
        }
    } catch (e) {
        console.log(`Direct scrape failed or timed out for "${search}":`, e instanceof Error ? e.message : e);
    }

    // 2. If direct query failed (blocked by Akamai on datacenter IPs), fall back to Firecrawl
    if (!directOk) {
        try {
            console.log(`Scraping eBay completed values for "${search}" via Firecrawl HTML...`);
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            const apiKey = userApiKey || process.env.FIRECRAWL_API_KEY;
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
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
                    source = 'firecrawl-success';
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
    }

    const median = calculateMedianPrice(prices);

    return Response.json({
        value: median,
        pricesCount: prices.length,
        source
    });
}


