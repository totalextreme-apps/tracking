import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ml_default';

interface UploadResult {
    url: string;
    publicId: string;
}

export async function uploadToCloudinary(fileData: Blob | string | any): Promise<UploadResult> {
    if (!CLOUD_NAME) {
        throw new Error('Cloudinary Cloud Name is not configured');
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    if (Platform.OS !== 'web') {
        let uri = typeof fileData === 'string' ? fileData : fileData?.uri;
        if (!uri) throw new Error("No pure URI provided for native filesystem upload");

        // If it's a data URL on native, FileSystem.uploadAsync won't work.
        // We handle it with fetch if it's a data URL.
        if (uri.startsWith('data:')) {
            console.log('Detected data URL on native, using fetch fallback');
        } else {
            console.log('Using expo-file-system native upload for:', uri);
            const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
                httpMethod: 'POST',
                uploadType: 1, // FileSystemUploadType.MULTIPART
                fieldName: 'file',
                mimeType: 'image/jpeg',
                parameters: {
                    upload_preset: UPLOAD_PRESET,
                },
            });

            if (uploadResult.status < 200 || uploadResult.status >= 300) {
                console.error('Cloudinary native upload error:', uploadResult.body);
                throw new Error(`Cloudinary Upload Failed (${uploadResult.status})`);
            }

            const data = JSON.parse(uploadResult.body);
            return {
                url: data.secure_url,
                publicId: data.public_id
            };
        }
    }

    // Web OR Native Data URL fallback
    console.log('Starting fetch-based upload...');
    let uploadPayload = fileData;

    // Help convert data URLs to Blobs for better Safari/Chrome mobile support
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
        try {
            const response = await fetch(fileData);
            uploadPayload = await response.blob();
            console.log('Converted data URL to Blob using fetch');
        } catch (e) {
            console.error('Failed to convert data URL to blob', e);
        }
    }

    const formData = new FormData();
    formData.append('file', uploadPayload);
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        let errorMsg = 'Failed to upload image to Cloudinary';
        try {
            const error = await response.json();
            console.error('Cloudinary terminal error:', error);
            errorMsg = error.error?.message || errorMsg;
        } catch (e) {
            console.error('Could not parse error JSON');
        }
        throw new Error(errorMsg);
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
