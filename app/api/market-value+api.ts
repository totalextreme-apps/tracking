import { parseEbayPrices, calculateMedianPrice } from '../../lib/pricing';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const search = url.searchParams.get('s');

    if (!search) {
        return Response.json({ error: 'Missing search query' }, { status: 400 });
    }

    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(search)}&LH_Complete=1&LH_Sold=1`;
    let prices: number[] = [];
    let source = 'ebay-api-success';
    let directOk = false;

    // 1. Try direct scraper query first
    try {
        const response = await fetch(ebayUrl, {
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
            } else {
                console.warn(`Direct eBay query returned 0 parsed prices for "${search}".`);
            }
        } else {
            console.warn(`Direct eBay query returned non-OK status: ${response.status} for "${search}".`);
        }
    } catch (e) {
        console.warn(`Direct eBay query failed or threw error for "${search}":`, e);
    }

    // 2. Fallback to Firecrawl keyless scrape if direct query fails or returns no prices
    if (!directOk) {
        console.log(`Attempting Firecrawl fallback for: "${search}"`);
        try {
            const firecrawlRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: ebayUrl,
                    formats: ['markdown']
                })
            });

            if (firecrawlRes.ok) {
                const firecrawlData = await firecrawlRes.json();
                if (firecrawlData.success && firecrawlData.data?.markdown) {
                    const markdown = firecrawlData.data.markdown;
                    const priceRegex = /^\$(\d+\.\d{2})$/gm;
                    let match;
                    while ((match = priceRegex.exec(markdown)) !== null) {
                        prices.push(parseFloat(match[1]));
                    }
                    source = 'firecrawl-fallback-success';
                } else {
                    console.error('Firecrawl response success is false or missing markdown:', firecrawlData);
                    source = 'firecrawl-no-data';
                }
            } else {
                console.error(`Firecrawl response error status: ${firecrawlRes.status}`);
                source = 'firecrawl-request-failed';
            }
        } catch (err) {
            console.error('Firecrawl fallback request threw error:', err);
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
