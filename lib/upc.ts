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

    let clean = title;

    // 1. Remove common VHS/DVD eBay/Amazon listing garbage
    const garbageRegex = /\b(VHS|DVD|Blu-?ray|4K|Ultra HD|Widescreen|Full Screen|Edition|Brand New|New Sealed|Sealed|Tape|Tapes|Cassette|Movie|Movies|Build Your Own|Pick & Choose|Updated|Lot|Digital(?: Code| Copy| HD)?|No Digital Code|\d+-Disc(?: Set)?|Disc(?: Set)?|Set)\b/gi;
    clean = clean.replace(garbageRegex, '');

    // 2. Remove "part 1 & 2"
    clean = clean.replace(/\bpart\s+\d+(\s*&\s*\d+)?\b/gi, '');

    // 3. Remove typical Studio / Genre trash usually appended at the end
    const studioRegex = /(?:Lions Gate|Lionsgate|Sony Pictures|Warner Bros|Universal Studios|Paramount|Disney|Twentieth Century Fox|20th Century Fox)\s*(?:Sci-Fi|Fantasy|Horror|Comedy|Action|Drama|Thriller|&|\s|-)*$/gi;
    clean = clean.replace(studioRegex, '');

    // 4. Remove literal characters often used for emphasis or stray tags
    clean = clean.replace(/\[.*?\]/g, '');
    clean = clean.replace(/[!]/g, '');

    // 5. Remove trailing dates like 8/25
    clean = clean.replace(/\b\d{1,2}\/\d{1,2}\b/g, '');

    // 6. Clean up orphaned punctuation inside parentheses, e.g., ( + ) or ( / , ) or ()
    clean = clean.replace(/\([\s\-\/+,&]*\)/g, '');

    // 7. Clean up parenthesis that only have leftover junk after previous replaces
    // e.g., "( Set- )" - specific fallback just in case
    clean = clean.replace(/\(\s*(?:set|-)+\s*\)/gi, '');

    // 8. Clean multiple spaces
    clean = clean.replace(/\s+/g, ' ').trim();

    // 9. Clean trailing punctuation like:, - /
    clean = clean.replace(/[:,\-\/]+$/, '').trim();

    // If the UPC API returned a string of purely numbers that looks like a UPC/EAN (5+ digits), reject it.
    // We allow short numbers like "451", "1917" or "2001" because they might be valid titles, 
    // even though in cases like Jacob's Ladder returning "451", the UPC DB is just wrong.
    if (/^\d{5,}$/.test(clean)) {
        return '';
    }

    return clean;
}
