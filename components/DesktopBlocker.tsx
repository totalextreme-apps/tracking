import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

// Desktop Blocker - V3 (Force Render Fix)
export const DesktopBlocker = () => {
    if (Platform.OS !== 'web') return null;

    return (
        <View style={styles.container}>
            {/* Scanline Effect Overlay */}
            <View style={styles.scanlines} pointerEvents="none" />

            <View style={styles.content}>
                <View style={styles.tvTube}>
                    <View style={styles.header}>
                        <Text style={styles.headerText}>SIGNAL: CHANNEL 01</Text>
                        <Text style={styles.headerText}>[ PUBLIC ACCESS ]</Text>
                    </View>

                    <View style={styles.messageBox}>
                        <Text style={styles.title}>ACCESS RESTRICTED</Text>
                        <Text style={styles.body}>
                            THE TRACKING INTERFACE IS OPTIMIZED FOR PORTABLE HANDHELD UNITS ONLY.
                        </Text>
                        <Text style={styles.body}>
                            PLEASE TERMINATE THIS SESSION AND RECONNECT VIA A MOBILE TELECOMMUNICATIONS DEVICE.
                        </Text>

                        <View style={styles.blinkContainer}>
                            <Text style={styles.blinkText}>INSERT MOBILE DEVICE TO CONTINUE</Text>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>© 1984 TRACKING SYSTEMS CORP.</Text>
                        <Text style={styles.footerText}>MODE: HANDHELD ONLY</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999,
    },
    scanlines: {
        ...StyleSheet.absoluteFillObject,
        // @ts-ignore
        backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.05), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.05))',
        backgroundSize: '100% 4px, 3px 100%',
        zIndex: 100,
    },
    content: {
        width: '90%',
        maxWidth: 800,
        aspectRatio: 1.33, // 4:3 Ratio
        backgroundColor: '#333333', // Outer shell
        padding: 15,
        borderRadius: 50,
        borderWidth: 4,
        borderColor: '#444444',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.8,
        shadowRadius: 30,
    },
    tvTube: {
        flex: 1,
        backgroundColor: '#0000AA', // Classic CRT blue
        borderRadius: 35,
        padding: 40,
        justifyContent: 'space-between',
        borderWidth: 8,
        borderColor: '#111',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 2,
        borderBottomColor: '#ffffff',
        paddingBottom: 10,
    },
    headerText: {
        color: '#ffffff',
        fontFamily: 'SpaceMono',
        fontSize: 16,
        fontWeight: 'bold',
    },
    messageBox: {
        alignItems: 'center',
    },
    title: {
        color: '#FFFF00',
        fontFamily: 'SpaceMono',
        fontSize: 42,
        fontWeight: 'bold',
        marginBottom: 30,
        textAlign: 'center',
        textShadowColor: 'rgba(255, 255, 0, 0.5)',
        textShadowOffset: { width: 4, height: 4 },
        textShadowRadius: 2,
    },
    body: {
        color: '#ffffff',
        fontFamily: 'SpaceMono',
        fontSize: 20,
        lineHeight: 32,
        textAlign: 'center',
        marginBottom: 20,
        textTransform: 'uppercase',
    },
    blinkContainer: {
        marginTop: 20,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#ffffff',
    },
    blinkText: {
        color: '#0000AA',
        fontFamily: 'SpaceMono',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 2,
        borderTopColor: '#ffffff',
        paddingTop: 10,
    },
    footerText: {
        color: '#ffffff',
        fontFamily: 'SpaceMono',
        fontSize: 12,
    },
});
