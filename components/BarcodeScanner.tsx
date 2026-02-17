import { CameraView } from 'expo-camera';
import React from 'react';

interface BarcodeScannerProps {
    onScanned: (result: { type: string; data: string }) => void;
    barcodeTypes?: string[];
}

export default function BarcodeScanner({ onScanned, barcodeTypes }: BarcodeScannerProps) {
    // @ts-ignore - barcodeTypes mismatch in some expo versions, but works at runtime
    return (
        <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={onScanned}
            barcodeScannerSettings={{
                barcodeTypes: barcodeTypes as any || ["upc_a", "upc_e", "ean13", "ean8", "qr", "code128", "code39"],
            }}
        />
    );
}
