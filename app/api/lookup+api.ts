export async function GET(request: Request) {
    const url = new URL(request.url);
    const upc = url.searchParams.get('code');

    if (!upc) {
        return Response.json({ error: 'Missing UPC code' }, { status: 400 });
    }

    try {
        // 1. Try UPCItemDB
        const upcUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`;
        const upcResponse = await fetch(upcUrl);

        if (upcResponse.ok) {
            const data = await upcResponse.json();
            if (data.items && data.items.length > 0) {
                return Response.json({
                    source: 'upcitemdb',
                    title: data.items[0].title
                });
            }
        }

        // 2. Try OpenFoodFacts Fallback
        const offUrl = `https://world.openfoodfacts.org/api/v0/product/${upc}.json`;
        const offResponse = await fetch(offUrl);

        if (offResponse.ok) {
            const data = await offResponse.json();
            if (data.status === 1 && data.product && data.product.product_name) {
                return Response.json({
                    source: 'openfoodfacts',
                    title: data.product.product_name
                });
            }
        }

        return Response.json({ error: 'Not found' }, { status: 404 });

    } catch (error) {
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
