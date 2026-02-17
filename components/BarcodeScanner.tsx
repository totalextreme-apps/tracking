import { CameraView } from 'expo-camera';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface BarcodeScannerProps {
    onScanned: (result: { type: string; data: string }) => void;
    onClose: () => void;
    barcodeTypes?: string[];
}

export default function BarcodeScanner({ onScanned, onClose, barcodeTypes }: BarcodeScannerProps) {
    // @ts-ignore - barcodeTypes mismatch in some expo versions, but works at runtime
    return (
        <View style={{ flex: 1, backgroundColor: 'black' }}>
            <CameraView
                style={{ flex: 1 }}
                facing="back"
                onBarcodeScanned={onScanned}
                barcodeScannerSettings={{
                    barcodeTypes: barcodeTypes as any || ["upc_a", "upc_e", "ean13", "ean8", "qr", "code128", "code39"],
                }}
            />
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

            <TouchableOpacity
                onPress={onClose}
                style={{
                    position: 'absolute',
                    top: 60,
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
