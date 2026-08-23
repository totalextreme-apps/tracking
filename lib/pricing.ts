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
 * Checks if the matched price is likely a shipping cost based on surrounding text segment.
 */
function isShippingContext(text: string, index: number, matchedStr: string): boolean {
    // Find segment start (nearest punctuation/separator before index)
    const textBefore = text.slice(0, index);
    const lastSeparatorBefore = Math.max(
        textBefore.lastIndexOf('.'),
        textBefore.lastIndexOf(';'),
        textBefore.lastIndexOf('|'),
        textBefore.lastIndexOf('\n'),
        textBefore.lastIndexOf('\r'),
        textBefore.lastIndexOf('\t'),
        textBefore.lastIndexOf('  ') // double space as listing separator
    );
    const segmentStart = lastSeparatorBefore === -1 ? 0 : lastSeparatorBefore + 1;

    // Find segment end (nearest punctuation/separator after index)
    const textAfter = text.slice(index + matchedStr.length);
    const firstSeparatorAfter = textAfter.search(/[\.;|\n\r\t]|\s{2}/);
    const segmentEnd = firstSeparatorAfter === -1 ? text.length : index + matchedStr.length + firstSeparatorAfter;

    // Extract the segment containing the match
    const segment = text.slice(segmentStart, segmentEnd).toLowerCase();

    // 1. If preceded by a '+' (indicating a shipping addition, e.g., "+$5.39" or "+ $5.39")
    // Look at context immediately preceding the match within the segment
    const contextBeforeMatch = text.slice(segmentStart, index).trim();
    if (contextBeforeMatch.endsWith('+')) {
        return true;
    }
    
    // 2. If the segment contains shipping keywords as whole words
    const shippingRegex = /\b(shipping|postage|delivery)\b/i;
    if (shippingRegex.test(segment)) {
        return true;
    }

    return false;
}

/**
 * Parses eBay search results HTML and extracts listing prices.
 */
export function parseEbayPrices(html: string): number[] {
    const prices: number[] = [];
    
    // Robust class matching regex that handles single/double quotes, spaces, and other attributes
    const priceRegex = /class\s*=\s*["']([^"']*)(s-item__price|s-card__price|POSITIVE|text-positive|ITEM_PRICE)([^"']*)["'][^>]*>([\s\S]*?)<\/span>/gi;
    let match;

    while ((match = priceRegex.exec(html)) !== null) {
        const fullClass = (match[1] + match[2] + match[3]).toLowerCase();
        
        // Skip if class is shipping/postage/delivery/logistics related
        if (fullClass.includes('shipping') || fullClass.includes('logistics') || fullClass.includes('postage') || fullClass.includes('delivery')) {
            continue;
        }

        let priceText = match[4].replace(/<[^>]*>/g, '').trim();
        
        // Handle price ranges (e.g. "$10.00 to $15.00") by taking the first value
        if (priceText.includes('to')) {
            priceText = priceText.split('to')[0].trim();
        }
        
        // Remove currency symbols, commas, etc.
        const cleanPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (!isNaN(cleanPrice) && cleanPrice > 0) {
            // Apply contextual filtering even for class matches to protect against false positives
            const matchIndex = match.index;
            if (isShippingContext(html, matchIndex, priceText)) {
                continue;
            }
            prices.push(cleanPrice);
        }
    }

    // Fallback: If no prices found via classes (e.g. Firecrawl stripped them or mobile layout changed), 
    // extract all dollar amounts from the page text and filter out obvious non-item prices.
    if (prices.length === 0) {
        const cleanText = html.replace(/<[^>]*>/g, ' ');
        // Match $XX.XX format
        const dollarRegex = /\$([0-9,]+\.[0-9]{2})/g;
        let looseMatch;
        while ((looseMatch = dollarRegex.exec(cleanText)) !== null) {
            const cleanPrice = parseFloat(looseMatch[1].replace(/,/g, ''));
            if (!isNaN(cleanPrice) && cleanPrice > 0) {
                const matchIndex = looseMatch.index;
                if (isShippingContext(cleanText, matchIndex, looseMatch[0])) {
                    continue;
                }
                prices.push(cleanPrice);
            }
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
                    formats: ['rawHtml'],
                    blockAds: true,
                    removeBase64Images: true
                }),
                ...fetchOptions
            });

            if (firecrawlRes.ok) {
                const firecrawlData = await firecrawlRes.json();
                if (firecrawlData.success && firecrawlData.data?.rawHtml) {
                    const html = firecrawlData.data.rawHtml;
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
