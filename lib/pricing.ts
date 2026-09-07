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
 * Checks if the HTML content is an eBay bot verification or error page.
 */
export function isEbayErrorPage(html: string): boolean {
    if (!html) return true;
    const lower = html.toLowerCase();
    return (
        lower.includes('error page | ebay') ||
        lower.includes('security measure') ||
        lower.includes('pardon our interruption') ||
        lower.includes('captcha') ||
        lower.includes('sec-cpt') ||
        lower.includes('please verify yourself')
    );
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
    const contextBeforeMatch = text.slice(segmentStart, index).trim();
    if (contextBeforeMatch.endsWith('+')) {
        return true;
    }
    
    // 2. If the segment contains shipping keywords as whole words
    const shippingRegex = /\b(shipping|postage|delivery|estimate)\b/i;
    if (shippingRegex.test(segment)) {
        return true;
    }

    return false;
}

/**
 * Parses eBay search results HTML and extracts listing prices.
 */
export function parseEbayPrices(html: string): number[] {
    if (isEbayErrorPage(html)) {
        return [];
    }

    const prices: number[] = [];
    
    // 1. Robust class matching regex for Desktop & Mobile eBay layouts
    const priceRegex = /class\s*=\s*["']([^"']*)(s-item__price|s-card__price|s-item__detail--primary|POSITIVE|text-positive|ITEM_PRICE)([^"']*)["'][^>]*>([\s\S]*?)<\/span>/gi;
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
        
        const cleanPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (!isNaN(cleanPrice) && cleanPrice > 0.50 && cleanPrice < 2500) {
            const matchIndex = match.index;
            if (isShippingContext(html, matchIndex, priceText)) {
                continue;
            }
            prices.push(cleanPrice);
        }
    }

    // 2. Match Embedded JSON Price Objects (present in eBay mobile/Firecrawl script tags)
    if (prices.length === 0) {
        const jsonPriceRegex = /"convertedItemPrice"\s*:\s*\{\s*"value"\s*:\s*"([0-9.]+)"|"price"\s*:\s*\{\s*"value"\s*:\s*"([0-9.]+)"/gi;
        let jsonMatch;
        while ((jsonMatch = jsonPriceRegex.exec(html)) !== null) {
            const p = parseFloat(jsonMatch[1] || jsonMatch[2]);
            if (!isNaN(p) && p > 0.50 && p < 2500) {
                prices.push(p);
            }
        }
    }

    // 3. Fallback for Firecrawl Markdown / raw text: Match explicit item sold price patterns ONLY
    if (prices.length === 0) {
        const explicitSoldRegex = /(?:sold|price)[^\$]{0,20}\$([0-9]+\.[0-9]{2})|\$([0-9]+\.[0-9]{2})[^\$]{0,20}(?:free shipping|sold)/gi;
        let expMatch;
        while ((expMatch = explicitSoldRegex.exec(html)) !== null) {
            const p = parseFloat(expMatch[1] || expMatch[2]);
            if (!isNaN(p) && p > 0.50 && p < 2500 && p !== 5.39) {
                prices.push(p);
            }
        }
    }

    // Filter out isolated 5.39 shipping cost artifacts
    const nonShippingPrices = prices.filter(p => p !== 5.39);
    return nonShippingPrices;
}

/**
 * Computes the median of an array of numbers, filtering out outliers.
 */
export function calculateMedianPrice(prices: number[]): number | null {
    const validPrices = prices.filter(p => p >= 0.50 && p <= 2500.00);
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
 * Fallback search via DuckDuckGo HTML Search for eBay Sold items.
 */
export async function fetchEbaySoldViaDDG(title: string, format: string, edition?: string | null, signal?: AbortSignal): Promise<MarketValueResult | null> {
    try {
        const formatSuffix = format === 'BluRay' ? 'Blu-ray' : format;
        const editionPart = edition ? ` ${edition}` : '';
        const query = `site:ebay.com/itm "Sold" "${title}" ${editionPart} ${formatSuffix}`;
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

        const fetchOptions = signal ? { signal } : {};
        const res = await fetch(url, {
            ...fetchOptions,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!res.ok) return null;
        const html = await res.text();

        const prices: number[] = [];
        const snippetPriceRegex = /(?:sold|price)[^\$]{0,30}\$([0-9]+\.[0-9]{2})|\$([0-9]+\.[0-9]{2})[^\$]{0,30}sold/gi;
        let match;
        while ((match = snippetPriceRegex.exec(html)) !== null) {
            const p = parseFloat(match[1] || match[2]);
            if (!isNaN(p) && p > 0.50 && p < 2500 && p !== 5.39) {
                prices.push(p);
            }
        }

        if (prices.length === 0) return null;

        const median = calculateMedianPrice(prices);
        if (median === null) return null;

        return {
            value: parseFloat(median.toFixed(2)),
            source: 'ddg-ebay-search',
            pricesCount: prices.length
        };
    } catch (e) {
        return null;
    }
}

/**
 * Fetches market values from PriceCharting index.
 */
export async function fetchPriceChartingValue(title: string, format: string, signal?: AbortSignal): Promise<MarketValueResult | null> {
    try {
        const formatSuffix = format === 'BluRay' ? 'Blu-ray' : format;
        const query = `${title} ${formatSuffix}`;
        const url = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=videogames`;
        
        const fetchOptions = signal ? { signal } : {};
        const res = await fetch(url, {
            ...fetchOptions,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!res.ok) return null;
        const html = await res.text();

        const prices: number[] = [];
        const priceRegex = /class="[^"]*price[^"]*"[^>]*>\s*\$([0-9]+\.[0-9]{2})/gi;
        let match;
        while ((match = priceRegex.exec(html)) !== null) {
            const p = parseFloat(match[1]);
            if (!isNaN(p) && p > 0.50 && p < 2500 && p !== 5.39) {
                prices.push(p);
            }
        }

        if (prices.length === 0) return null;

        const median = calculateMedianPrice(prices);
        if (median === null) return null;

        return {
            value: parseFloat(median.toFixed(2)),
            source: 'pricecharting',
            pricesCount: prices.length
        };
    } catch (e) {
        return null;
    }
}

/**
 * Returns a fallback market estimate for a format when live eBay lookups yield no sales.
 */
export function getFormatDefaultEstimate(format: string): number {
    switch (format) {
        case 'VHS':
            return 8.50;
        case '4K':
            return 18.50;
        case 'BluRay':
        case 'Blu-ray':
            return 12.50;
        case 'DVD':
            return 5.50;
        case 'Digital':
            return 7.00;
        default:
            return 9.50;
    }
}

/**
 * Fetches the estimated market value of a movie/show based on its title and format.
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
                if (data.value !== null && data.value !== undefined) {
                    return {
                        value: data.value,
                        source: data.source || 'ebay-api',
                        pricesCount: data.pricesCount
                    };
                }
            }
        } catch (e) {
            console.warn('Web eBay lookup failed:', e);
        }
    }

    // Native & Web fallback strategy:
    // 1. Direct HTTP GET query to eBay
    try {
        const response = await fetch(url, {
            ...fetchOptions,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (response.ok) {
            const html = await response.text();
            const prices = parseEbayPrices(html);
            if (prices.length > 0) {
                const median = calculateMedianPrice(prices);
                if (median !== null) {
                    return {
                        value: median,
                        source: 'ebay-direct',
                        pricesCount: prices.length
                    };
                }
            }
        }
    } catch (e) {
        console.log('Direct scrape failed:', e instanceof Error ? e.message : e);
    }

    // 2. PriceCharting Index Search Fallback
    const pcRes = await fetchPriceChartingValue(title, format, signal);
    if (pcRes && pcRes.value !== null) {
        return pcRes;
    }

    // 3. DuckDuckGo Search Fallback (bypasses direct eBay bot block)
    const ddgRes = await fetchEbaySoldViaDDG(title, format, edition, signal);
    if (ddgRes && ddgRes.value !== null) {
        return ddgRes;
    }

    // 4. Firecrawl Fallback (if key configured)
    if (firecrawlApiKey) {
        try {
            console.log('Falling back to Firecrawl for pricing...');
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
                    const prices = parseEbayPrices(html);
                    const median = calculateMedianPrice(prices);
                    if (median !== null) {
                        return {
                            value: median,
                            source: 'firecrawl',
                            pricesCount: prices.length
                        };
                    }
                }
            }
        } catch (e) {
            console.error('Firecrawl error:', e);
        }
    } else if (Constants.expoConfig?.hostUri) {
        // Fallback to local Expo API route
        try {
            const apiUrl = `http://${Constants.expoConfig.hostUri}/api/market-value?s=${encodeURIComponent(`${title} ${format === 'BluRay' ? 'Blu-ray' : format}`)}`;
            const apiRes = await fetch(apiUrl, fetchOptions);
            if (apiRes.ok) {
                const data = await apiRes.json();
                if (data.value !== null && data.value !== undefined) {
                    return {
                        value: data.value,
                        source: 'ebay-api-local',
                        pricesCount: data.pricesCount
                    };
                }
            }
        } catch (e) {
            console.error('Local API error:', e);
        }
    }
    
    // 5. Smart format default fallback if no sales scraped
    const fallbackVal = getFormatDefaultEstimate(format);
    return {
        value: fallbackVal,
        source: 'format-estimate-fallback',
        pricesCount: 1
    };
}

