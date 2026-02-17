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

                            // Try standard scan first
                            html5QrCode.scanFileV2(file, true)
                                .then(decodedResult => {
                                    onScanned({
                                        type: 'photo',
                                        data: decodedResult.decodedText
                                    });
                                })
                                .catch(async (err) => {
                                    console.warn("Standard file scan failed, trying to preprocess...", err);

                                    // Preprocess: Load image, draw to canvas, try rotations
                                    try {
                                        const imageUrl = URL.createObjectURL(file);
                                        const img = new Image();
                                        img.onload = async () => {
                                            const canvas = document.createElement('canvas');
                                            const ctx = canvas.getContext('2d');
                                            if (!ctx) return;

                                            // Max dimensions to avoid memory issues (1080p limit)
                                            const MAX_DIM = 1920;
                                            let width = img.width;
                                            let height = img.height;

                                            if (width > MAX_DIM || height > MAX_DIM) {
                                                const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
                                                width *= ratio;
                                                height *= ratio;
                                            }

                                            // Attempt 1: Standard Orientation (baked in)
                                            canvas.width = width;
                                            canvas.height = height;
                                            ctx.drawImage(img, 0, 0, width, height);

                                            try {
                                                const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
                                                if (blob) {
                                                    const file1 = new File([blob], "processed.jpg", { type: "image/jpeg" });
                                                    const res = await html5QrCode.scanFileV2(file1, true);
                                                    onScanned({ type: 'photo-processed', data: res.decodedText });
                                                    URL.revokeObjectURL(imageUrl);
                                                    return;
                                                }
                                            } catch (e) {
                                                console.log("Attempt 1 failed");
                                            }

                                            // Attempt 2: Rotate 90 degrees
                                            canvas.width = height;
                                            canvas.height = width;
                                            ctx.save();
                                            ctx.translate(height / 2, width / 2);
                                            ctx.rotate(90 * Math.PI / 180);
                                            ctx.drawImage(img, -width / 2, -height / 2, width, height);
                                            ctx.restore();

                                            try {
                                                const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
                                                if (blob) {
                                                    const file2 = new File([blob], "rotated.jpg", { type: "image/jpeg" });
                                                    const res = await html5QrCode.scanFileV2(file2, true);
                                                    onScanned({ type: 'photo-rotated', data: res.decodedText });
                                                    URL.revokeObjectURL(imageUrl);
                                                    return;
                                                }
                                            } catch (e) {
                                                console.log("Attempt 2 failed");
                                                alert("Could not find barcode even after rotation processing. Please try a clearer photo.");
                                            }

                                            URL.revokeObjectURL(imageUrl);
                                        };
                                        img.src = imageUrl;
                                    } catch (preprocessErr) {
                                        console.error("Preprocessing failed", preprocessErr);
                                        alert("Could not process image.");
                                    }
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
