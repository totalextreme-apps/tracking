import { DBSchema, IDBPDatabase, openDB } from 'idb';

interface CustomArtDB extends DBSchema {
    'custom-art': {
        key: string; // item_id
        value: {
            itemId: string;
            imageBlob: Blob;
            timestamp: number;
        };
    };
}

const DB_NAME = 'tracking-custom-art';
const STORE_NAME = 'custom-art';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CustomArtDB>> | null = null;

async function getDB(): Promise<IDBPDatabase<CustomArtDB>> {
    if (!dbPromise) {
        dbPromise = openDB<CustomArtDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'itemId' });
                }
            },
        });
    }
    return dbPromise;
}

export async function saveCustomArt(itemId: string, imageBlob: Blob): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, {
        itemId,
        imageBlob,
        timestamp: Date.now(),
    });
}

export async function getCustomArt(itemId: string): Promise<string | null> {
    try {
        const db = await getDB();
        const record = await db.get(STORE_NAME, itemId);
        if (!record) return null;

        // Convert Blob to data URL
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(record.imageBlob);
        });
    } catch (e) {
        console.error('Failed to get custom art:', e);
        return null;
    }
}

export async function deleteCustomArt(itemId: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, itemId);
}

export async function getAllArtMetadata(): Promise<Array<{ itemId: string; size: number; timestamp: number }>> {
    const db = await getDB();
    const allRecords = await db.getAll(STORE_NAME);
    return allRecords.map(record => ({
        itemId: record.itemId,
        size: record.imageBlob.size,
        timestamp: record.timestamp,
    }));
}

export async function exportAllArt(): Promise<Blob> {
    const JSZip = (await import('jszip')).default;
    const db = await getDB();
    const allRecords = await db.getAll(STORE_NAME);

    const zip = new JSZip();
    const manifest: Record<string, { timestamp: number; filename: string }> = {};

    for (const record of allRecords) {
        const filename = `${record.itemId}.jpg`;
        zip.file(filename, record.imageBlob);
        manifest[record.itemId] = {
            timestamp: record.timestamp,
            filename,
        };
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    return await zip.generateAsync({ type: 'blob' });
}

export async function importArt(zipBlob: Blob): Promise<number> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipBlob);

    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
        throw new Error('Invalid backup file: missing manifest.json');
    }

    const manifestText = await manifestFile.async('text');
    const manifest: Record<string, { timestamp: number; filename: string }> = JSON.parse(manifestText);

    let importedCount = 0;

    for (const [itemId, meta] of Object.entries(manifest)) {
        const imageFile = zip.file(meta.filename);
        if (imageFile) {
            const imageBlob = await imageFile.async('blob');
            await saveCustomArt(itemId, imageBlob);
            importedCount++;
        }
    }

    return importedCount;
}
