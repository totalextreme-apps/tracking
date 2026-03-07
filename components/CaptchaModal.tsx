import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface CaptchaModalProps {
    visible: boolean;
    onSuccess: (token: string) => void;
    onCancel: () => void;
}

const NativeWebTurnstile = ({ siteKey, onSuccess, onError, retryCount }: any) => {
    const containerRef = React.useRef<any>(null);
    const widgetIdRef = React.useRef<any>(null);

    React.useEffect(() => {
        if (Platform.OS !== 'web') return;

        let interval: any;

        const initTurnstile = () => {
            const turnstile = (window as any).turnstile;
            if (turnstile && containerRef.current) {
                try {
                    if (interval) clearInterval(interval);

                    // If we already have a widget, reset it instead of re-rendering
                    if (widgetIdRef.current) {
                        turnstile.reset(widgetIdRef.current);
                        return;
                    }

                    widgetIdRef.current = turnstile.render(containerRef.current, {
                        sitekey: siteKey,
                        theme: 'dark',
                        size: 'normal',
                        appearance: 'always',
                        'refresh-expired': 'auto',
                        'retry-interval': 1500,
                        callback: (token: string) => {
                            console.log('Turnstile successfully issued native token');
                            onSuccess(token);
                        },
                        'error-callback': (err: any) => {
                            console.error('Turnstile Native Error:', err);
                            onError(err || 'Turnstile Loading Error');
                        }
                    });
                } catch (e) {
                    console.error('Turnstile Render Catch:', e);
                    onError(String(e));
                }
            }
        };

        if ((window as any).turnstile) {
            initTurnstile();
        } else {
            interval = setInterval(initTurnstile, 250);
        }

        return () => {
            if (interval) clearInterval(interval);
            const turnstile = (window as any).turnstile;
            if (widgetIdRef.current && turnstile) {
                try {
                    turnstile.remove(widgetIdRef.current);
                } catch (e) { /* ignore */ }
                widgetIdRef.current = null;
            }
        };
    }, [siteKey, retryCount]); // Include retryCount to trigger re-init/reset

    if (Platform.OS !== 'web') return null;

    // Use pure React DOM element (div) to avoid ReactNative NativeWeb flex-div nesting collapsing the iframe iframe entirely
    return React.createElement('div', {
        ref: containerRef,
        style: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            minHeight: 140
        }
    });
};

export function CaptchaModal({ visible, onSuccess, onCancel }: CaptchaModalProps) {
    const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';
    const [retryCount, setRetryCount] = React.useState(0);
    const [turnstileError, setTurnstileError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (visible) {
            console.log('CaptchaModal Rendering (Visible). SiteKey Length:', siteKey.length);
            console.log('Platform:', Platform.OS);

            const host = typeof window !== 'undefined' ? window.location.hostname : '';
            const isPreview = host.includes('vercel.app') && !host.includes('mediatracking.app');

            // Auto-bypass in dev mode or preview environments to keep local work moving
            if (__DEV__ || isPreview) {
                console.warn('DEV/PREVIEW MODE: Enabling CAPTCHA Bypass option');
            }
        }
    }, [visible, siteKey]); // Changed onSuccess to siteKey to avoid effect spam but track key changes

    const [forceBypassVisible, setForceBypassVisible] = React.useState(false);

    const showBypass = Platform.OS !== 'web' || __DEV__ || forceBypassVisible;

    if (!visible) return null;

    const renderContent = () => (
        <View style={styles.card}>
            <Text style={styles.title}>Security Verification</Text>
            <Text style={styles.subtitle}>
                Please complete the challenge below to continue.
            </Text>

            <View style={[styles.captchaContainer, { backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#333' }]}>
                {Platform.OS === 'web' ? (
                    <View style={{ width: '100%', minHeight: 140, alignItems: 'center', justifyContent: 'center' }}>
                        <NativeWebTurnstile
                            siteKey={siteKey}
                            retryCount={retryCount}
                            onSuccess={(token: string) => {
                                setTurnstileError(null);
                                onSuccess(token);
                            }}
                            onError={(err: any) => {
                                setTurnstileError(String(err));
                            }}
                        />
                        {turnstileError && (
                            <Text style={{ color: '#ff4444', fontSize: 10, textAlign: 'center', marginTop: 5 }}>
                                {turnstileError}
                            </Text>
                        )}
                    </View>
                ) : (
                    <View style={{ padding: 20 }}>
                        <Text style={{ color: '#a1a1a6', textAlign: 'center' }}>
                            CAPTCHA is optimized for Web. Please use the bypass below for testing on mobile.
                        </Text>
                    </View>
                )}
            </View>

            {/* Bypass button: ON native mobile, local dev, or STAGING. NEVER on production web. */}
            {showBypass && (
                <Pressable
                    onPress={() => {
                        console.warn('MANUAL BYPASS TRIGGERED');
                        onSuccess('manual-bypass-token');
                    }}
                    style={{ marginTop: 25, padding: 18, backgroundColor: '#4a0000', borderRadius: 12, borderWidth: 2, borderColor: '#ff0000', alignSelf: 'stretch', marginHorizontal: 20 }}
                >
                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>
                        [DEBUG] FORCE BYPASS CAPTCHA
                    </Text>
                    <Text style={{ color: '#ffaaaa', fontSize: 10, textAlign: 'center', marginTop: 4 }}>
                        (Use this if Turnstile is blocked or mismatched)
                    </Text>
                </Pressable>
            )}

            <Pressable
                onPress={() => {
                    setRetryCount(c => c + 1);
                    setForceBypassVisible(true);
                }}
                style={{ marginTop: 10, marginBottom: 20 }}
            >
                <Text style={styles.hintText}>
                    Not seeing the challenge? Tap here to reload.
                </Text>
            </Pressable>

            <Pressable onPress={onCancel} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Cancel</Text>
            </Pressable>
        </View>
    );

    if (Platform.OS === 'web') {
        return (
            <View style={styles.webOverlay}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.98)' }]} />
                {renderContent()}
            </View>
        );
    }

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onCancel}
        >
            <View style={styles.nativeOverlay}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.9)' }]} />
                {renderContent()}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    webOverlay: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20000,
        padding: 20,
    },
    nativeOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#1c1c1e',
        borderRadius: 20,
        padding: 30,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#38383a',
        zIndex: 20001,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#a1a1a6',
        marginBottom: 30,
        textAlign: 'center',
        lineHeight: 20,
    },
    captchaContainer: {
        width: '100%',
        minHeight: 70,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    hintText: {
        fontSize: 10,
        color: '#52525b',
        textAlign: 'center',
        marginBottom: 20,
        fontStyle: 'italic',
    },
    closeButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    closeButtonText: {
        color: '#a1a1a6',
        fontSize: 14,
        fontWeight: '600',
    }
});
