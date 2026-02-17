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
            const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
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
    return null;
}
