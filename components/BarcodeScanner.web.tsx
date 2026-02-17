import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

interface BarcodeScannerProps {
    onScanned: (result: { type: string; data: string }) => void;
    barcodeTypes?: string[];
}

const formatMap: Record<string, number> = {
    'upc_a': Html5QrcodeSupportedFormats.UPC_A,
    'upc_e': Html5QrcodeSupportedFormats.UPC_E,
    'ean13': Html5QrcodeSupportedFormats.EAN_13,
    'ean8': Html5QrcodeSupportedFormats.EAN_8,
    'qr': Html5QrcodeSupportedFormats.QR_CODE,
    'code128': Html5QrcodeSupportedFormats.CODE_128,
    'code39': Html5QrcodeSupportedFormats.CODE_39,
};

export default function BarcodeScanner({ onScanned, barcodeTypes }: BarcodeScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const elementId = 'html5-qrcode-scanner';

    useEffect(() => {
        const formats = barcodeTypes
            ? barcodeTypes.map(t => formatMap[t]).filter(f => f !== undefined)
            : [
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
            ];

        const html5QrCode = new Html5Qrcode(elementId);
        scannerRef.current = html5QrCode;

        // iOS Optimization: 
        // 1. Remove fixed aspectRatio (causes drift/crop issues on some iOS devices)
        // 2. Use videoConstraints to request environment camera explicitly with preference for higher res
        // 3. Adjust qrbox to be responsive

        const config = {
            fps: 10,
            qrbox: { width: 300, height: 300 }, // Larger scanning area
            // aspectRatio: 1.0, // REMOVED: potentially breaks iOS
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            }
        };

        const startScanning = async () => {
            try {
                await html5QrCode.start(
                    {
                        facingMode: "environment"
                    },
                    config,
                    (decodedText, decodedResult) => {
                        onScanned({
                            type: decodedResult.result.format?.formatName || 'unknown',
                            data: decodedText
                        });
                    },
                    (errorMessage) => {
                        // console.log(errorMessage);
                    }
                );
            } catch (err) {
                console.error("Failed to start scanner", err);
                // Fallback: try without experimental features or different constraints if needed
            }
        };

        startScanning();

        return () => {
            if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().catch(err => console.error("Failed to stop scanner", err));
            }
        };
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: 'black' }}>
            <div id={elementId} style={{ width: '100%', height: '100%' }} />
        </View>
    );
}
