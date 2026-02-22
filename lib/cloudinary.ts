const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ml_default';

interface UploadResult {
    url: string;
    publicId: string;
}

export async function uploadToCloudinary(blob: Blob): Promise<UploadResult> {
    if (!CLOUD_NAME) {
        throw new Error('Cloudinary Cloud Name is not configured');
    }

    const formData = new FormData();
    formData.append('file', blob);
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
            method: 'POST',
            body: formData,
        }
    );

    if (!response.ok) {
        const error = await response.json();
        console.error('Cloudinary upload error:', error);
        throw new Error(error.error?.message || 'Failed to upload image to Cloudinary');
    }

    const data = await response.json();
    return {
        url: data.secure_url,
        publicId: data.public_id
    };
}

/**
 * Calls our secure Vercel API to delete an image by its URL or Public ID
 */
export async function deleteFromCloudinary(imageUrl: string): Promise<boolean> {
    try {
        const response = await fetch('/api/delete-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.warn('Image deletion API failed:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error calling delete API:', error);
        return false;
    }
}
