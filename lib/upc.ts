import { Platform } from 'react-native';

export async function lookupUPC(upc: string): Promise<string | null> {
    const codesToCheck = [
        upc,
        upc.replace(/^0+/, ''), // Try without leading zeros
        `0${upc}` // Try with extra zero (EAN-13)
    ];

    // Deduplicate
    const uniqueCodes = Array.from(new Set(codesToCheck));

    if (Platform.OS === 'web') {
        // Web: Use our own Server API Route (proxies request, handles CORS/Secrets)
        for (const code of uniqueCodes) {
            if (code.length < 8) continue;
            try {
                const res = await fetch(`/api/lookup?code=${code}`);
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
            const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
            if (response.ok) {
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    return cleanTitle(data.items[0].title);
                }
            }

            // 2. OpenFoodFacts Fallback
            const offResponse = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
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
    return title.replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/DVD/i, '')
        .replace(/Blu-ray/i, '')
        .replace(/4K/i, '')
        .replace(/Ultra HD/i, '')
        .replace(/Widescreen/i, '')
        .replace(/Edition/i, '')
        .trim()
        .replace(/[:,-]+$/, '')
        .split('  ')[0]
        .trim();
}
