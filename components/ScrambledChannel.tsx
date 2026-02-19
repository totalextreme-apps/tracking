import { useSound } from '@/context/SoundContext';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { useFonts } from 'expo-font';
import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

interface ScrambledChannelProps {
    onRetry: () => void;
}

export const ScrambledChannel: React.FC<ScrambledChannelProps> = ({ onRetry }) => {
    const { playSound } = useSound();
    const [loaded] = useFonts({
        SpaceMono: SpaceMono_400Regular,
        SpaceMonoBold: SpaceMono_700Bold,
    });

    // Animation values for the "scramble" effect
    const skewX = useSharedValue(0);
    const translateX = useSharedValue(0);
    const layer2Offset = useSharedValue(0);
    const layer3Offset = useSharedValue(0);

    useEffect(() => {
        // Start high-frequency jitter
        skewX.value = withRepeat(
            withSequence(
                withTiming(15, { duration: 50 }),
                withTiming(-15, { duration: 50 })
            ),
            -1,
            true
        );

        translateX.value = withRepeat(
            withSequence(
                withTiming(20, { duration: 80 }),
                withTiming(-20, { duration: 80 })
            ),
            -1,
            true
        );

        layer2Offset.value = withRepeat(
            withSequence(
                withTiming(30, { duration: 120 }),
                withTiming(-30, { duration: 120 })
            ),
            -1,
            true
        );

        layer3Offset.value = withRepeat(
            withSequence(
                withTiming(-25, { duration: 100 }),
                withTiming(25, { duration: 100 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyles = {
        layer1: useAnimatedStyle(() => ({
            transform: [{ skewX: `${skewX.value}deg` }, { translateX: translateX.value }],
        })),
        layer2: useAnimatedStyle(() => ({
            transform: [{ skewX: `${-skewX.value}deg` }, { translateX: layer2Offset.value }],
        })),
        layer3: useAnimatedStyle(() => ({
            transform: [{ skewX: `${skewX.value * 0.5}deg` }, { translateX: layer3Offset.value }],
        })),
    };

    if (!loaded) return null;

    return (
        <View style={styles.container}>
            {/* 1. SCRAMBLED COLOR LAYERS (Rainbow Background) */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Animated.View style={[styles.colorLayer, { backgroundColor: '#FF0000' }, animatedStyles.layer1]} />
                <Animated.View style={[styles.colorLayer, { backgroundColor: '#00FF00', opacity: 0.6 }, animatedStyles.layer2]} />
                <Animated.View style={[styles.colorLayer, { backgroundColor: '#0000FF', opacity: 0.4 }, animatedStyles.layer3]} />
                <Animated.View style={[styles.colorLayer, { backgroundColor: '#FFFF00', opacity: 0.3 }, animatedStyles.layer1]} />
            </View>

            {/* 2. SCANLINES */}
            <View style={styles.scanlines} pointerEvents="none" />

            {/* 3. CRT TV FRAME & MESSAGE */}
            <View style={styles.content}>
                <View style={styles.tvTube}>
                    <View style={styles.header}>
                        <Text style={styles.headerText}>SIGNAL: CHANNEL 403</Text>
                        <Text style={styles.headerText}>[ SCRAMBLED ]</Text>
                    </View>

                    <View style={styles.messageBox}>
                        <Text style={styles.title}>DESCRAMBLER MALFUNCTION</Text>
                        <Text style={styles.body}>
                            YOU DO NOT HAVE THE CREDENTIALS TO VIEW THIS CHANNEL. TERMINATE THIS SIGNAL AND VERIFY YOUR CREDENTIALS AGAIN.
                        </Text>

                        <View style={styles.buttonWrapper}>
                            <Pressable
                                onPress={() => {
                                    playSound('click');
                                    onRetry();
                                }}
                                style={({ pressed }) => [
                                    styles.button,
                                    pressed && { backgroundColor: '#e6d22a', transform: [{ scale: 0.98 }] }
                                ]}
                            >
                                <Text style={styles.buttonText}>RE-SYNC SIGNAL</Text>
                            </Pressable>
                            <Text style={styles.descriptor}>(RETRY VERIFICATION)</Text>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>© 1984 TRACKING SYSTEMS CORP.</Text>
                        <Text style={styles.footerText}>CRYPT MODE: ACTIVE</Text>
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
        overflow: 'hidden',
    },
    colorLayer: {
        ...StyleSheet.absoluteFillObject,
        width: '120%',
        left: '-10%',
    },
    scanlines: {
        ...StyleSheet.absoluteFillObject,
        // @ts-ignore - Web background image
        backgroundImage: Platform.OS === 'web'
            ? 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.05), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.05))'
            : undefined,
        backgroundSize: Platform.OS === 'web' ? '100% 4px, 3px 100%' : undefined,
        zIndex: 10,
    },
    content: {
        width: '90%',
        maxWidth: 600,
        aspectRatio: Platform.OS === 'web' ? 1.33 : undefined,
        backgroundColor: '#222',
        padding: 10,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: '#333',
        zIndex: 20,
    },
    tvTube: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderRadius: 30,
        padding: 24,
        justifyContent: 'space-between',
        borderWidth: 4,
        borderColor: '#111',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.3)',
        paddingBottom: 8,
    },
    headerText: {
        color: '#ffffff',
        fontFamily: 'SpaceMono',
        fontSize: 12,
        fontWeight: 'bold',
    },
    messageBox: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    title: {
        color: '#FFFF00',
        fontFamily: 'SpaceMono',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        textShadowColor: 'rgba(255, 255, 0, 0.5)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 1,
    },
    body: {
        color: '#ffffff',
        fontFamily: 'SpaceMono',
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 30,
        textTransform: 'uppercase',
    },
    buttonWrapper: {
        alignItems: 'center',
        gap: 8,
    },
    button: {
        backgroundColor: '#FFFF00',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    buttonText: {
        color: '#000000',
        fontFamily: 'SpaceMono',
        fontSize: 16,
        fontWeight: 'bold',
    },
    descriptor: {
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'SpaceMono',
        fontSize: 10,
        textTransform: 'uppercase',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.3)',
        paddingTop: 8,
    },
    footerText: {
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'SpaceMono',
        fontSize: 10,
    },
});
