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

        if (!scannerRef.current) {
            const html5QrCode = new Html5Qrcode(elementId);
            scannerRef.current = html5QrCode;
        }
        const html5QrCode = scannerRef.current;

        // iOS Optimization Round 3: 
        // 1. Disable native barcode detector (can be flaky on iOS web)
        // 2. Remove specific qrbox dimensions to allow scanning of the entire feed
        //    (The UI overlay guides the user, but we want the scanner to be permissive)

        const config = {
            fps: 15,
            // qrbox: { width: 300, height: 300 }, // REMOVED: Scanning entire frame is safer for high-res feeds
            // experimentalFeatures: {
            //     useBarCodeDetectorIfSupported: true // REMOVED: specific issues reported with this on iOS 17+
            // },
            videoConstraints: {
                facingMode: "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                // @ts-ignore - focusMode is supported by some browsers but missing in standard type definition
                advanced: [{ focusMode: "continuous" }]
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

            {/* Fallback: File Upload for "Take Photo" */}
            <View style={{
                position: 'absolute',
                bottom: 40,
                left: 0,
                right: 0,
                alignItems: 'center',
                zIndex: 100
            }}>
                <input
                    type="file"
                    id="qr-input-file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                            const file = e.target.files[0];
                            const html5QrCode = new Html5Qrcode(elementId);
                            html5QrCode.scanFileV2(file, true)
                                .then(decodedResult => {
                                    onScanned({
                                        type: 'photo',
                                        data: decodedResult.decodedText
                                    });
                                })
                                .catch(err => {
                                    console.warn("Error scanning file", err);
                                    alert("Could not find a barcode in this image. Please try again with a clearer photo.");
                                });
                        }
                    }}
                />
                <button
                    onClick={() => document.getElementById('qr-input-file')?.click()}
                    style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.5)',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        backdropFilter: 'blur(4px)',
                        cursor: 'pointer'
                    }}
                >
                    📸 Take Photo instead
                </button>
            </View>
        </View>
    );
}
