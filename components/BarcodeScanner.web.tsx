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

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
        };

        html5QrCode.start(
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
        ).catch((err) => {
            console.error("Failed to start scanner", err);
        });

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current?.clear();
                }).catch(err => console.error("Failed to stop scanner", err));
            }
        };
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: 'black' }}>
            <div id={elementId} style={{ width: '100%', height: '100%' }} />
        </View>
    );
}
