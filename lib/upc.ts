import { Platform } from 'react-native';

export async function lookupUPC(upc: string, signal?: AbortSignal): Promise<string | null> {
    const codesToCheck = [
        upc,
        upc.replace(/^0+/, ''), // Try without leading zeros
        `0${upc}` // Try with extra zero (EAN-13)
    ];

    // Deduplicate
    const uniqueCodes = Array.from(new Set(codesToCheck));
    const fetchOptions = signal ? { signal } : {};

    if (Platform.OS === 'web') {
        // Web: Use our own Server API Route (proxies request, handles CORS/Secrets)
        for (const code of uniqueCodes) {
            if (code.length < 8) continue;
            try {
                const res = await fetch(`/api/lookup?code=${code}`, fetchOptions);
                if (res.ok) {
                    const data = await res.json();
                    if (data.title) return cleanTitle(data.title);
                }
            } catch (e) {
                console.warn(`Web Lookup Error for ${code}:`, e);
            }
        }
        return upc;
    }

    // Native: Direct Fetch (No CORS issues)
    for (const code of uniqueCodes) {
        if (code.length < 8) continue;

        try {
            console.log(`Checking UPC: ${code}`);

            // 1. UPCItemDB
            const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, fetchOptions);
            if (response.ok) {
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    return cleanTitle(data.items[0].title);
                }
            }

            // 2. OpenFoodFacts Fallback
            const offResponse = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`, fetchOptions);
            if (offResponse.ok) {
                const data = await offResponse.json();
                if (data.status === 1 && data.product && data.product.product_name) {
                    return cleanTitle(data.product.product_name);
                }
            }

        } catch (e) {
            console.error(`UPC Lookup error for ${code}: ${e}`);
        }

        // Add delay to avoid rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return upc;
}

function cleanTitle(title: string): string {
    if (!title) return '';

    // Remove common VHS/DVD eBay listing garbage
    let clean = title
        .replace(/\b(VHS|DVD|Blu-?ray|4K|Ultra HD|Widescreen|Edition|Brand New|New Sealed|Sealed|Tape|Tapes|Cassette|Movie|Movies|Build Your Own|Pick & Choose|Updated|Lot)\b/gi, '')
        // Clean out specific parts like "part 1 & 2"
        .replace(/\bpart\s+\d+(\s*&\s*\d+)?\b/gi, '')
        // Remove literal characters often used for emphasis
        .replace(/[!]/g, '')
        .replace(/\[.*?\]/g, '')
        // Remove trailing dates like 8/25
        .replace(/\d{1,2}\/\d{1,2}/g, '')
        .trim();
        
    // Default parenthesis stripping:
    // Removing all parentheses can backfire for titles like "(500) Days of Summer"
    // Let's only strip parentheses if they contain formats or are trailing.
    clean = clean.replace(/\((VHS|DVD|Widescreen|Blu-ray|Sealed|New|Cassette)\)/gi, '');

    clean = clean.replace(/\s+/g, ' ')
        .trim()
        .replace(/[:,-]+$/, '')
        .trim();

    // If the UPC API returned a string of purely numbers that looks like a UPC/EAN (5+ digits), reject it.
    // We allow short numbers like "451", "1917" or "2001" because they might be valid titles, 
    // even though in cases like Jacob's Ladder returning "451", the UPC DB is just wrong.
    if (/^\d{5,}$/.test(clean)) {
        return '';
    }

    return clean;
}
