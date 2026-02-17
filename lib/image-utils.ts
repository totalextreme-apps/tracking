/**
 * Image compression and processing utilities for custom cover art.
 */

export async function compressImage(
    blob: Blob,
    maxWidth: number = 400,
    quality: number = 0.85
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Calculate new dimensions maintaining aspect ratio
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            // Create canvas and compress
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (compressedBlob) => {
                    if (compressedBlob) {
                        resolve(compressedBlob);
                    } else {
                        reject(new Error('Failed to compress image'));
                    }
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}

/**
 * Crop an image to a specific aspect ratio (e.g., 2:3 for posters)
 * Returns a data URL of the cropped image
 */
export async function cropToRatio(
    imageUri: string,
    targetRatio: number = 2 / 3
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const sourceRatio = img.width / img.height;

            let sourceX = 0;
            let sourceY = 0;
            let sourceWidth = img.width;
            let sourceHeight = img.height;

            if (sourceRatio > targetRatio) {
                // Image is wider than target, crop sides
                sourceWidth = img.height * targetRatio;
                sourceX = (img.width - sourceWidth) / 2;
            } else if (sourceRatio < targetRatio) {
                // Image is taller than target, crop top/bottom
                sourceHeight = img.width / targetRatio;
                sourceY = (img.height - sourceHeight) / 2;
            }

            const canvas = document.createElement('canvas');
            canvas.width = sourceWidth;
            canvas.height = sourceHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(
                img,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                sourceWidth,
                sourceHeight
            );

            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = imageUri;
    });
}
