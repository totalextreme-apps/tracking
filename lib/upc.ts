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
    const garbageRegex = /\b(VHS|DVD|Blu-?ray|4K|Ultra HD|Widescreen|Full Screen|Edition|Brand New|New Sealed|Sealed|Tape|Tapes|Cassette|Movie|Movies|Build Your Own|Pick & Choose|Updated|Lot|Digital(?: Code| Copy| HD)?|No Digital Code|\d+-Disc(?: Set)?|Disc(?: Set)?|Set|Used|Pre-owned|Rental|Library|Copy|Format|Collectors?|Special|Limited|Anniversary|Deluxe|Standard|Remastered|Restored|Unrated|Theatrical|Director's Cut|Extended|Anthology|Collection|Boxset|Box Set|Series|Trilogy|Quadrilogy|Franchise|Bundle|Pack|Volume|Vol|vols?|Double Feature|Two-Pack|Multi-Pack|Season|Seasons|Complete|Series)\b/gi;
    clean = clean.replace(garbageRegex, '');

    // 2. Remove "part 1 & 2"
    clean = clean.replace(/\bpart\s+\d+(\s*&\s*\d+)?\b/gi, '');

    // 3. Remove common Studios and Production Companies
    const studioRegex = /\b(Universal|Monsters|Warner|Sony|Paramount|Disney|Fox|Lionsgate|MGM|Columbia|TriStar|Dreamworks|Pixar|Marvel|DC|HBO|Showtime|A24|Neon|Criterion|Kino Lorber|Shout Factory|Scream Factory|Vinegar Syndrome|Arrow Video|Blue Underground|Severin|Vestron|Anchor Bay|Artisan|Live Home Video|Republic Pictures|Miramax|Dimension)\b/gi;
    clean = clean.replace(studioRegex, '');

    // 4. Remove Common Actor Names (Heuristic: long lists of names at the end)
    const actorHeuristic = /\b(Lon Chaney Jr|Bela Lugosi|Boris Karloff|Vincent Price|Christopher Lee|Peter Cushing|Patrick Swayze|Tom Cruise|Brad Pitt|Johnny Depp|Arnold Schwarzenegger|Sylvester Stallone|Bruce Willis|Harrison Ford|Mel Gibson|Nicolas Cage|Keanu Reeves|Samuel L Jackson|Morgan Freeman|Denzel Washington|Robert De Niro|Al Pacino|Dustin Hoffman|Meryl Streep|Julia Roberts|Sandra Bullock|Scarlett Johansson|Angelina Jolie)\b/gi;
    clean = clean.replace(actorHeuristic, '');

    // 5. Remove literal characters often used for emphasis or stray tags
    clean = clean.replace(/\[.*?\]/g, '');
    clean = clean.replace(/[!]/g, '');
    clean = clean.replace(/[*]/g, '');

    // 6. Remove trailing dates like 8/25
    clean = clean.replace(/\b\d{1,2}\/\d{1,2}\b/g, '');

    // 7. Clean up orphaned punctuation inside parentheses, e.g., ( + ) or ( / , ) or ()
    clean = clean.replace(/\([\s\-\/+,&]*\)/g, '');

    // 8. Clean up parenthesis that only have leftover junk after previous replaces
    clean = clean.replace(/\(\s*(?:set|-)+\s*\)/gi, '');

    // 9. Clean multiple spaces
    clean = clean.replace(/\s+/g, ' ').trim();

    // 10. Clean trailing punctuation like:, - /
    clean = clean.replace(/[:,\-\/]+$/, '').trim();

    // If the UPC API returned a string of purely numbers that looks like a UPC/EAN (5+ digits), reject it.
    // We allow short numbers like "451", "1917" or "2001" because they might be valid titles, 
    // even though in cases like Jacob's Ladder returning "451", the UPC DB is just wrong.
    if (/^\d{5,}$/.test(clean)) {
        return '';
    }

    return clean;
}
