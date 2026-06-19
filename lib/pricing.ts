import { Platform } from 'react-native';

export interface MarketValueResult {
    value: number | null;
    source?: string;
    pricesCount?: number;
}

/**
 * Builds the eBay Completed/Sold search URL for a given title and format.
 */
export function getEbaySearchUrl(title: string, format: string): string {
    const formatSuffix = format === 'BluRay' ? 'Blu-ray' : format;
    const query = `${title} ${formatSuffix}`;
    return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1`;
}

/**
 * Parses eBay search results HTML and extracts listing prices.
 */
export function parseEbayPrices(html: string): number[] {
    const prices: number[] = [];
    const priceRegex = /class="[^"]*s-item__price[^"]*">([\s\S]*?)<\/span>/g;
    let match;

    while ((match = priceRegex.exec(html)) !== null) {
        let priceText = match[1].replace(/<[^>]*>/g, '').trim();
        
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
    const validPrices = prices.filter(p => p >= 1.00 && p <= 200.00);
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
export async function fetchEbaySoldValue(title: string, format: string, signal?: AbortSignal): Promise<MarketValueResult> {
    const url = getEbaySearchUrl(title, format);
    const fetchOptions = signal ? { signal } : {};

    if (Platform.OS === 'web') {
        try {
            const queryParam = `${title} ${format === 'BluRay' ? 'Blu-ray' : format}`;
            const apiRes = await fetch(`/api/market-value?s=${encodeURIComponent(queryParam)}`, fetchOptions);
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

        if (!response.ok) {
            console.warn(`Direct eBay fetch returned status: ${response.status}`);
            return { value: null };
        }

        const html = await response.text();
        const prices = parseEbayPrices(html);
        const median = calculateMedianPrice(prices);

        return {
            value: median,
            source: 'ebay-direct',
            pricesCount: prices.length
        };
    } catch (e) {
        console.error('Error fetching eBay sold value directly:', e);
        return { value: null };
    }
}
