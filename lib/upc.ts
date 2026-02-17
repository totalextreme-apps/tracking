import { Platform } from 'react-native';

export async function lookupUPC(upc: string): Promise<string | null> {
    const codesToCheck = [
        upc,
        upc.replace(/^0+/, ''), // Try without leading zeros
        `0${upc}` // Try with extra zero (EAN-13)
    ];

    // Deduplicate
    const uniqueCodes = Array.from(new Set(codesToCheck));

    for (const code of uniqueCodes) {
        if (code.length < 8) continue; // Skip too short

        try {
            console.log(`Checking UPC: ${code}`);

            // Web CORS Proxy
            const baseUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`;
            const url = Platform.OS === 'web'
                ? `https://corsproxy.io/?${encodeURIComponent(baseUrl)}`
                : baseUrl;

            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 429) console.warn('UPC API Rate limited');
                continue;
            }
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                let title = data.items[0].title;
                console.log(`Found raw title: ${title}`);

                // Clean Title
                // Remove [DVD], (Blu-ray), etc.
                title = title.replace(/\[.*?\]/g, '')
                    .replace(/\(.*?\)/g, '')
                    .replace(/DVD/i, '')
                    .replace(/Blu-ray/i, '')
                    .replace(/4K/i, '')
                    .replace(/Ultra HD/i, '')
                    .replace(/Widescreen/i, '')
                    .replace(/Edition/i, '')
                    .trim();

                // Remove trailing special chars
                title = title.replace(/[:,-]+$/, '').trim();

                // Aggressive Heuristic: Split by double space
                // API often returns "Title  Studio  Genre"
                if (title.includes('  ')) {
                    title = title.split('  ')[0].trim();
                }

                console.log(`Cleaned title: ${title}`);
                return title;
            }
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error(`UPC Lookup error for ${code}: ${errorMsg}`);
        }

        // Add delay to avoid rate limit (especially for trial API)
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Fallback: OpenFoodFacts (often has media items)
    for (const code of uniqueCodes) {
        if (code.length < 8) continue;
        try {
            console.log(`Checking OpenFoodFacts: ${code}`);
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
            if (!response.ok) continue;

            const data = await response.json();
            if (data.status === 1 && data.product && data.product.product_name) {
                console.log(`Found OFF title: ${data.product.product_name}`);
                return data.product.product_name;
            }
        } catch (e) {
            console.warn(`OFF Lookup error: ${e}`);
        }
    }

    // Final Fallback: Return the code itself to allow manual search/entry
    // The UI will see this, put it in the search bar, and user can edit it.
    return upc;
}
