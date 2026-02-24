import { Turnstile } from '@marsidev/react-turnstile';
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface CaptchaModalProps {
    visible: boolean;
    onSuccess: (token: string) => void;
    onCancel: () => void;
}

export function CaptchaModal({ visible, onSuccess, onCancel }: CaptchaModalProps) {
    const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAACfqPZmY0_dkAil1';
    const [retryCount, setRetryCount] = React.useState(0);
    const [turnstileError, setTurnstileError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (visible) {
            console.log('CaptchaModal Rendering (Visible). SiteKey Length:', siteKey.length);
            console.log('Platform:', Platform.OS);

            // Auto-bypass in dev mode to keep local work moving
            if (__DEV__) {
                console.warn('DEV MODE: Auto-bypassing CAPTCHA');
                onSuccess('dev-manual-bypass');
            }
        }
    }, [visible, onSuccess]);

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
                        <Turnstile
                            key={`turnstile-${retryCount}`}
                            siteKey={siteKey}
                            options={{ theme: 'dark', size: 'compact' }}
                            scriptOptions={{
                                appendTo: 'body',
                                onError: () => {
                                    console.error('Turnstile Script Load Error');
                                    setTurnstileError('Script blocked by Safari Content Blockers or Network. Please disable block ad-blockers and reload.');
                                }
                            }}
                            onLoad={() => {
                                console.log('Turnstile widget loaded successfully');
                                setTurnstileError(null);
                            }}
                            onSuccess={(token) => {
                                console.log('Turnstile success inside modal');
                                setTurnstileError(null);
                                onSuccess(token);
                            }}
                            onError={(e) => {
                                console.error('Turnstile Error:', e);
                                setTurnstileError(String(e) || 'Unknown Script Error');
                            }}
                            onExpire={() => console.warn('Turnstile Expired')}
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

            {__DEV__ && (
                <Pressable
                    onPress={() => {
                        console.warn('MANUAL BYPASS TRIGGERED');
                        onSuccess('manual-bypass-token');
                    }}
                    style={{ marginTop: 15, padding: 10, backgroundColor: '#3b0000', borderRadius: 8 }}
                >
                    <Text style={{ color: '#ff4444', fontSize: 12, fontWeight: 'bold' }}>
                        [DEBUG] BYPASS CAPTCHA
                    </Text>
                </Pressable>
            )}

            <Pressable onPress={() => setRetryCount(c => c + 1)} style={{ marginTop: 10, marginBottom: 20 }}>
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
