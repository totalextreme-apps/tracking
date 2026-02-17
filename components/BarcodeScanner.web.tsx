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

        // iOS Optimization Round 2: 
        // 1. Explicitly request high resolution (1080p) to force correct lens usage on multi-lens iPhones
        // 2. Request continuous focus mode
        // 3. Fallback system if high-res fails

        const config = {
            fps: 15, // Increased FPS for faster scanning
            qrbox: { width: 300, height: 300 },
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            },
            // Important: videoConstraints can force specific camera modes
            videoConstraints: {
                facingMode: "environment",
                width: { ideal: 1920 }, // 1080p ideal
                height: { ideal: 1080 },
                advanced: [{ focusMode: "continuous" }] // Suggest continuous focus
            }
        };

        const startScanning = async () => {
            try {
                // First try with advanced constraints (High Res + Focus)
                await html5QrCode.start(
                    { facingMode: "environment" },
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
                console.warn("High-res scan start failed, retrying with basic config...", err);

                // Fallback: Basic config without advanced constraints
                try {
                    await html5QrCode.start(
                        { facingMode: "environment" },
                        { fps: 10, qrbox: 250 },
                        (decodedText, decodedResult) => {
                            onScanned({
                                type: decodedResult.result.format?.formatName || 'unknown',
                                data: decodedText
                            });
                        },
                        () => { }
                    );
                } catch (retryErr) {
                    console.error("Failed to start scanner (fallback)", retryErr);
                }
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
