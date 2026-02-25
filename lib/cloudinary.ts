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
            throw new Error(`Native Cloudinary Upload Failed: ${uploadResult.status}`);
        }

        const data = JSON.parse(uploadResult.body);
        return {
            url: data.secure_url,
            publicId: data.public_id
        };
    }

    // Help convert data URLs to Blobs for better Safari/Chrome mobile support
    let uploadPayload = fileData;
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
        try {
            const arr = fileData.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            uploadPayload = new Blob([u8arr], { type: mime });
            console.log('Converted data URL to Blob for upload');
        } catch (e) {
            console.error('Failed to convert data URL to blob, falling back to raw string', e);
        }
    }

    const formData = new FormData();
    formData.append('file', uploadPayload, 'upload.jpg');
    formData.append('upload_preset', UPLOAD_PRESET);

    console.log('Sending fetch request to Cloudinary...');
    const response = await fetch(
        uploadUrl,
        {
            method: 'POST',
            body: formData,
        }
    );

    if (!response.ok) {
        let errorMsg = 'Failed to upload image to Cloudinary';
        try {
            const error = await response.json();
            console.error('Cloudinary upload error response:', error);
            errorMsg = error.error?.message || errorMsg;
        } catch (e) {
            console.error('Failed to parse Cloudinary error JSON');
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
