import { calculateMedianPrice, fetchEbaySoldViaDDG, parseEbayPrices } from '../../lib/pricing';

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

    // 1. Try a direct HTTP query to eBay first
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
        }
    } catch (e) {
        console.log(`Direct scrape failed or timed out for "${search}":`, e instanceof Error ? e.message : e);
    }

    // 2. DuckDuckGo Search Fallback if direct scrape returned 0 prices
    if (!directOk) {
        try {
            console.log(`Attempting DDG fallback for "${search}"...`);
            const parts = search.split(' ');
            const format = parts[parts.length - 1] || '';
            const title = parts.slice(0, -1).join(' ') || search;
            
            const ddgResult = await fetchEbaySoldViaDDG(title, format);
            if (ddgResult && ddgResult.value !== null) {
                return Response.json({
                    value: ddgResult.value,
                    pricesCount: ddgResult.pricesCount,
                    source: ddgResult.source
                });
            }
        } catch (e) {
            console.warn('DDG fallback in API route failed:', e);
        }
    }

    // 3. Firecrawl Fallback (if key provided or configured)
    if (!directOk && (userApiKey || process.env.FIRECRAWL_API_KEY)) {
        try {
            console.log(`Scraping eBay completed values for "${search}" via Firecrawl HTML...`);
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            const apiKey = userApiKey || process.env.FIRECRAWL_API_KEY;
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }

            const firecrawlRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    url: ebayUrl,
                    formats: ['rawHtml'],
                    blockAds: true,
                    removeBase64Images: true
                })
            });

            if (firecrawlRes.ok) {
                const firecrawlData = await firecrawlRes.json();
                if (firecrawlData.success && firecrawlData.data?.rawHtml) {
                    const html = firecrawlData.data.rawHtml;
                    prices = parseEbayPrices(html);
                    source = 'firecrawl-success';
                }
            }
        } catch (err) {
            console.error('Firecrawl scrape request threw error:', err);
        }
    }

    const median = calculateMedianPrice(prices);

    return Response.json({
        value: median,
        pricesCount: prices.length,
        source
    });
}



