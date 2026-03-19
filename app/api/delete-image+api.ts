import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const { imageUrl } = await request.json();

        if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
            return Response.json({ error: 'Invalid or missing image URL' }, { status: 400 });
        }

        const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!cloudName || !apiKey || !apiSecret) {
            return Response.json({ error: 'Cloudinary server-side configuration missing' }, { status: 500 });
        }

        // 1. Extract Public ID from URL
        // Example: https://res.cloudinary.com/cloud/image/upload/v123/public_id.jpg
        const parts = imageUrl.split('/');
        const lastPart = parts[parts.length - 1];
        const publicId = lastPart.split('.')[0]; // Remove extension

        if (!publicId) {
            return Response.json({ error: 'Could not parse public ID' }, { status: 400 });
        }

        // 2. Generate Signature for Cloudinary API
        const timestamp = Math.round(new Date().getTime() / 1000).toString();
        const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;

        const signature = crypto
            .createHash('sha1')
            .update(signatureString)
            .digest('hex');


        // 3. Call Cloudinary Destroy API
        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
            {
                method: 'POST',
                body: formData,
            }
        );

        const result = await response.json();

        if (result.result === 'ok') {
            return Response.json({ success: true, publicId });
        } else {
            console.error('Cloudinary destroy failed:', result);
            return Response.json({ error: 'Cloudinary deletion failed', details: result }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Delete image API error:', error);
        return Response.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
    }
}
