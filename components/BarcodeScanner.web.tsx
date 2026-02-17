import { BarcodeDetectorPolyfill } from "barcode-detector-polyfill";
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

// Use native BarcodeDetector if available, otherwise use polyfill
const BarcodeDetector = (typeof window !== 'undefined' && (window as any).BarcodeDetector) || BarcodeDetectorPolyfill;

export default function BarcodeScanner({ onScanned, onClose }: { onScanned: (data: { type: string, data: string }) => void, onClose: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [hasCameraError, setHasCameraError] = useState(false);
    const [isScanning, setIsScanning] = useState(true);
    const streamRef = useRef<MediaStream | null>(null);

    // Initialize Camera
    useEffect(() => {
        const startCamera = async () => {
            try {
                // Request back camera
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "environment",
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        // @ts-ignore
                        advanced: [{ focusMode: "continuous" }]
                    }
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                    // Start scanning loop
                    scanFrame();
                }
            } catch (err) {
                console.error("Camera access error:", err);
                setHasCameraError(true);
            }
        };

        if (isScanning) {
            startCamera();
        }

        return () => {
            stopCamera();
        };
    }, [isScanning]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const scanFrame = async () => {
        if (!videoRef.current || !isScanning) return;

        try {
            // Check if detector is ready
            if (BarcodeDetector && typeof BarcodeDetector.getSupportedFormats === 'function') {
                // Create detector (ideally reuse, but cheap enough to init)
                const detector = new BarcodeDetector({
                    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'code_128']
                });

                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    onScanned({ type: barcodes[0].format, data: barcodes[0].rawValue });
                    setIsScanning(false); // Stop scanning on success
                    stopCamera();
                    return;
                }
            }
        } catch (e) {
            // Ignore frame errors, just retry
        }

        if (isScanning) {
            requestAnimationFrame(scanFrame);
        }
    };

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const detector = new BarcodeDetector({
                formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'code_128']
            });
            const bitmap = await createImageBitmap(file);
            const barcodes = await detector.detect(bitmap);

            if (barcodes.length > 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onScanned({ type: barcodes[0].format, data: barcodes[0].rawValue });
            } else {
                alert("No barcode found in image.");
            }
        } catch (e) {
            console.error("File scan error", e);
            alert("Error scanning file.");
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: 'black' }}>
            {/* Native Video Element */}
            <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <video
                    ref={videoRef}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    muted
                    playsInline
                />
            </div>

            {/* Visual Target Box Overlay */}
            <View pointerEvents="none" style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10
            }}>
                <View style={{
                    width: 250,
                    height: 250,
                    borderWidth: 2,
                    borderColor: '#00FF00',
                    borderRadius: 20
                }} />
                <Text style={{ color: 'white', marginTop: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 8 }}>
                    Align barcode in box
                </Text>
            </View>

            {/* Fallback: File Upload for "Take Photo" */}
            <View style={{
                position: 'absolute',
                bottom: 40,
                left: 0,
                right: 0,
                alignItems: 'center',
                zIndex: 20
            }}>
                <TouchableOpacity
                    onPress={handleFileSelect}
                    style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        paddingVertical: 12,
                        paddingHorizontal: 24,
                        borderRadius: 30,
                        borderWidth: 1,
                        borderColor: 'white',
                    }}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Take Photo instead</Text>
                </TouchableOpacity>
                <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
            </View>

            <TouchableOpacity
                onPress={onClose}
                style={{
                    position: 'absolute',
                    top: 40,
                    right: 20,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    padding: 8,
                    borderRadius: 20,
                    zIndex: 20
                }}
            >
                <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
        </View>
    );
}
