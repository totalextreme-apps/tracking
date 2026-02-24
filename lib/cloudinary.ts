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
        const uri = typeof fileData === 'string' ? fileData : fileData.uri;
        console.log('Using expo-file-system native upload for:', uri);

        const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
            httpMethod: 'POST',
            uploadType: (FileSystem as any).FileSystemUploadType?.MULTIPART || 1,
            fieldName: 'file',
            parameters: {
                upload_preset: UPLOAD_PRESET,
            },
        });

        if (uploadResult.status < 200 || uploadResult.status >= 300) {
            console.error('Cloudinary native upload error:', uploadResult.body);
            throw new Error(`Native Cloudinary Upload Failed: ${uploadResult.status}`);
        }

        const data = JSON.parse(uploadResult.body);
        return {
            url: data.secure_url,
            publicId: data.public_id
        };
    }

    const formData = new FormData();
    formData.append('file', fileData);
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(
        uploadUrl,
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
