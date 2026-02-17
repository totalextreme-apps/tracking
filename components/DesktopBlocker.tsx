import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

export const DesktopBlocker = () => {
    if (Platform.OS !== 'web') return null;

    return (
        <View style={styles.container}>
            {/* Scanline Effect Overlay */}
            <View style={styles.scanlines} pointerEvents="none" />

            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.headerText}>[ PUBLIC ACCESS CHANNEL 01 ]</Text>
                </View>

                <View style={styles.messageBox}>
                    <Text style={styles.title}>ACCESS RESTRICTED</Text>
                    <Text style={styles.body}>
                        THE TRACKING EXPERIENCE IS OPTIMIZED FOR PORTABLE HANDHELD UNITS ONLY.
                    </Text>
                    <Text style={styles.body}>
                        PLEASE DISCONTINUE USE OF THIS DESKTOP TERMINAL AND RECONNECT VIA MOBILE DEVICE.
                    </Text>

                    <View style={styles.blinkContainer}>
                        <Text style={styles.blinkText}>INSERT MOBILE DEVICE TO CONTINUE</Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>© 1984 TRACKING SYSTEMS CORP.</Text>
                    <Text style={styles.footerText}>SIGNAL STRENGTH: OPTIMAL</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000022', // Deep blue/black CRT background
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    scanlines: {
        ...StyleSheet.absoluteFillObject,
        // Creating scanlines using a repeating linear gradient
        // In React Native Web, we can use standard CSS strings for background
        // @ts-ignore
        backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
        backgroundSize: '100% 4px, 3px 100%',
        zIndex: 10,
    },
    content: {
        width: '80%',
        maxWidth: 600,
        backgroundColor: '#000066', // Classic blue background
        padding: 40,
        borderWidth: 4,
        borderColor: '#ffffff',
        shadowColor: '#00ffff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
    },
    header: {
        marginBottom: 30,
        borderBottomWidth: 2,
        borderBottomColor: '#ffffff',
        paddingBottom: 10,
    },
    headerText: {
        color: '#ffffff',
        fontFamily: 'SpaceMono',
        fontSize: 14,
        textAlign: 'center',
    },
    messageBox: {
        alignItems: 'center',
    },
    title: {
        color: '#ffff00', // Yellow for "RESTRICTED"
        fontFamily: 'SpaceMono',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    body: {
        color: '#ffffff',
        fontFamily: 'SpaceMono',
        fontSize: 18,
        lineHeight: 28,
        textAlign: 'center',
        marginBottom: 20,
    },
    blinkContainer: {
        marginTop: 20,
        padding: 10,
        backgroundColor: '#ffffff',
    },
    blinkText: {
        color: '#000066',
        fontFamily: 'SpaceMono',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    footer: {
        marginTop: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.3)',
        paddingTop: 10,
    },
    footerText: {
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'SpaceMono',
        fontSize: 10,
    },
});
