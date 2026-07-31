import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface MarketValueResult {
    value: number | null;
    source?: string;
    pricesCount?: number;
}

/**
 * Builds the eBay Completed/Sold search URL for a given title, format, and edition.
 */
export function getEbaySearchUrl(title: string, format: string, edition?: string | null): string {
    const formatSuffix = format === 'BluRay' ? 'Blu-ray' : format;
    const editionPart = edition ? ` ${edition}` : '';
    const query = `${title}${editionPart} ${formatSuffix}`;
    return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1`;
}

/**
 * Parses eBay search results HTML and extracts listing prices.
 */
export function parseEbayPrices(html: string): number[] {
    const prices: number[] = [];
    const priceRegex = /class="[^"]*(s-item__price|s-card__price|POSITIVE|text-positive)[^"]*">([\s\S]*?)<\/span>/gi;
    let match;

    while ((match = priceRegex.exec(html)) !== null) {
        let priceText = match[2].replace(/<[^>]*>/g, '').trim();
        
        // Handle price ranges (e.g. "$10.00 to $15.00") by taking the first value
        if (priceText.includes('to')) {
            priceText = priceText.split('to')[0].trim();
        }
        
        // Remove currency symbols, commas, etc.
        const cleanPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (!isNaN(cleanPrice) && cleanPrice > 0) {
            prices.push(cleanPrice);
        }
    }

    return prices;
}

/**
 * Computes the median of an array of numbers, filtering out outliers.
 */
export function calculateMedianPrice(prices: number[]): number | null {
    // Filter out potential outliers (e.g., shipping costs or extremely high bundles)
    const validPrices = prices.filter(p => p >= 0.10 && p <= 2000.00);
    if (validPrices.length === 0) return null;

    const sorted = [...validPrices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 !== 0) {
        return sorted[mid];
    } else {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
}

/**
 * Fetches the estimated market value of a movie/show based on its title and format.
 * - On Native: Direct client-side fetch to bypass CORS and Akamai blocks (using residential IPs).
 * - On Web: Calls local API route proxy.
 */
export async function fetchEbaySoldValue(title: string, format: string, edition?: string | null, signal?: AbortSignal, firecrawlApiKey?: string): Promise<MarketValueResult> {
    const url = getEbaySearchUrl(title, format, edition);
    const fetchOptions = signal ? { signal } : {};

    if (Platform.OS === 'web') {
        try {
            const formatSuffix = format === 'BluRay' ? 'Blu-ray' : format;
            const editionPart = edition ? ` ${edition}` : '';
            const queryParam = `${title}${editionPart} ${formatSuffix}`;
            
            const headers: Record<string, string> = {};
            if (firecrawlApiKey) {
                headers['x-firecrawl-api-key'] = firecrawlApiKey;
            }

            const apiRes = await fetch(`/api/market-value?s=${encodeURIComponent(queryParam)}`, {
                ...fetchOptions,
                headers
            });
            if (apiRes.ok) {
                const data = await apiRes.json();
                return {
                    value: data.value,
                    source: 'ebay-api',
                    pricesCount: data.pricesCount
                };
            }
        } catch (e) {
            console.warn('Web eBay lookup failed, CORS or proxy issue:', e);
        }
        return { value: null };
    }

    // Native platforms: direct HTTP GET request
    try {
        const response = await fetch(url, {
            ...fetchOptions,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        let prices: number[] = [];
        let directSuccess = false;

        if (response.ok) {
            const html = await response.text();
            prices = parseEbayPrices(html);
            if (prices.length > 0) {
                directSuccess = true;
                const median = calculateMedianPrice(prices);
                return {
                    value: median,
                    source: 'ebay-direct',
                    pricesCount: prices.length
                };
            }
        }

        if (!directSuccess && firecrawlApiKey) {
            console.log('Direct scrape failed or yielded 0 prices on native, falling back to Firecrawl...');
            const firecrawlRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${firecrawlApiKey}`
                },
                body: JSON.stringify({
                    url: url,
                    formats: ['html'],
                    blockAds: true,
                    removeBase64Images: true
                }),
                ...fetchOptions
            });

            if (firecrawlRes.ok) {
                const firecrawlData = await firecrawlRes.json();
                if (firecrawlData.success && firecrawlData.data?.html) {
                    const html = firecrawlData.data.html;
                    prices = parseEbayPrices(html);
                    const median = calculateMedianPrice(prices);
                    return {
                        value: median,
                        source: 'firecrawl',
                        pricesCount: prices.length
                    };
                }
            }
        } else if (!directSuccess && Constants.expoConfig?.hostUri) {
            // Fallback to local dev API if running in Expo development mode
            console.log('Falling back to local Expo API route...');
            const apiUrl = `http://${Constants.expoConfig.hostUri}/api/market-value?s=${encodeURIComponent(`${title} ${format === 'BluRay' ? 'Blu-ray' : format}`)}`;
            const apiRes = await fetch(apiUrl, fetchOptions);
            if (apiRes.ok) {
                const data = await apiRes.json();
                return {
                    value: data.value,
                    source: 'ebay-api-local',
                    pricesCount: data.pricesCount
                };
            }
        }
        
        return { value: null };
    } catch (e) {
        console.error('Error fetching eBay sold value directly:', e);
        return { value: null };
    }
}
