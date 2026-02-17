import BarcodeDetectorPolyfill from "barcode-detector-polyfill";
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Polyfill explicit handling
try {
    if (!('BarcodeDetector' in window)) {
        (window as any).BarcodeDetector = BarcodeDetectorPolyfill;
    }
} catch (e) {
    console.warn("Failed to init BarcodeDetector polyfill", e);
}

const BarcodeDetector = (window as any).BarcodeDetector;

export default function BarcodeScanner({ onScanned, onClose }: { onScanned: (data: { type: string, data: string }) => void, onClose: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isScanning, setIsScanning] = useState(true);
    const streamRef = useRef<MediaStream | null>(null);
    const rafId = useRef<number | null>(null);

    const startCamera = useCallback(async () => {
        try {
            // Georapbox uses 'environment' facing mode
            const constraints = {
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1280 }, // Good balance for performance/quality
                    aspectRatio: { ideal: 1 }, // Square aspect ratio often helps with polyfill crop
                    focusMode: "continuous"
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Wait for metadata to load before playing to ensure dimensions are known
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play().catch(e => console.error("Play error", e));
                    detectBarcode();
                };
            }
            setHasPermission(true);
        } catch (err) {
            console.error("Camera Error:", err);
            setHasPermission(false);
            alert("Could not access camera. Please ensure permissions are granted.");
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (rafId.current) cancelAnimationFrame(rafId.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, [startCamera, stopCamera]);

    const detectBarcode = async () => {
        if (!videoRef.current || !streamRef.current || !isScanning) return;

        // Safety check if video is ready
        if (videoRef.current.readyState < 2) {
            rafId.current = requestAnimationFrame(detectBarcode);
            return;
        }

        try {
            const detector = new BarcodeDetector({
                formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'code_128', 'code_39']
            });

            // Detect from video element directly
            const barcodes = await detector.detect(videoRef.current);

            if (barcodes.length > 0) {
                const barcode = barcodes[0];
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onScanned({ type: barcode.format, data: barcode.rawValue });
                setIsScanning(false);
                stopCamera();
                return;
            }
        } catch (e) {
            // Polyfill or detection error - silently retry
            // console.debug("Detection error", e);
        }

        if (isScanning) {
            rafId.current = requestAnimationFrame(detectBarcode);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.cameraContainer}>
                {/* 
                  Using native video element for maximum compatibility with polyfill.
                  Object-fit cover ensures it fills the screen.
                */}
                <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                    <video
                        ref={videoRef}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                        playsInline
                    />
                </div>
            </View>

            {/* Overlay */}
            <View style={styles.overlay} pointerEvents="none">
                <View style={styles.scanBox} />
                <Text style={styles.instructionText}>Based on georapbox/barcode-scanner</Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    cameraContainer: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    scanBox: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#00ff00',
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    instructionText: {
        color: 'white',
        marginTop: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        fontSize: 12,
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    closeButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
