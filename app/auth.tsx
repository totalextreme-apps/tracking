import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
    const insets = useSafeAreaInsets();
    const { requestCaptcha } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [signUpSuccess, setSignUpSuccess] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    async function handleAuth() {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setLoading(true);
        setErrorMsg('');
        Keyboard.dismiss();

        requestCaptcha(async (captchaToken) => {
            console.log(`Proceeding with ${mode} using token length:`, captchaToken.length);

            try {
                // Development Bypass handling for Supabase calls
                const options = (captchaToken === 'manual-bypass-token' || captchaToken === 'dev-manual-bypass')
                    ? {} // Skip token if it's a bypass (Supabase might still fail if strict, but this matches our anon logic)
                    : { captchaToken };

                if (mode === 'signup') {
                    const { data, error } = await supabase.auth.signUp({
                        email,
                        password,
                        options,
                    });
                    if (error) throw error;
                    if (data.session) {
                        // Show welcome screen before entering the app
                        setShowWelcome(true);
                    } else {
                        // Email confirmation required — show in-screen success state
                        setSignUpSuccess(true);
                    }
                } else {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                        options,
                    });
                    if (error) throw error;
                    if (data.session) {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace('/');
                        }
                    }
                }
            } catch (error: any) {
                setErrorMsg(error.message || 'An error occurred. Please try again.');
            } finally {
                setLoading(false);
            }
        });
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-neutral-950"
        >
            <ScrollView className="flex-1 bg-neutral-950 pt-4" contentContainerStyle={{ paddingHorizontal: 32, paddingBottom: insets.bottom + 32 }}>
                <View style={{ maxWidth: 800, alignSelf: 'center', width: '100%' }}>
                    <Pressable
                        onPress={() => {
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace('/');
                            }
                        }}
                        className="mb-12 mt-4 bg-[#0000FF] px-4 py-1.5 rounded-md self-start shadow-sm"
                    >
                        <Text
                            className="text-white text-[10px] font-bold uppercase tracking-widest"
                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                        >
                            BACK
                        </Text>
                    </Pressable>

                    <View className="mb-8">
                        <Text
                            className="text-white text-3xl font-bold mb-2 tracking-tighter"
                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                        >
                            {mode === 'signin' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
                        </Text>
                        <Text className="text-neutral-400 font-mono text-sm">
                            {mode === 'signin'
                                ? 'Enter your credentials to access your collection.'
                                : 'Sign up to sync your collection across devices.'}
                        </Text>
                    </View>

                    {/* Welcome screen — shown after immediate sign-up success */}
                    {showWelcome ? (
                        <View className="flex-1 items-center justify-center py-16">
                            <FontAwesome name="film" size={52} color="#f59e0b" style={{ marginBottom: 24 }} />
                            <Text
                                className="text-amber-500 text-3xl font-bold mb-3 text-center"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                WELCOME TO{'\n'}TRACKING
                            </Text>
                            <Text className="text-neutral-400 font-mono text-sm text-center leading-6 mb-2 px-4">
                                Your account has been created.{'\n'}Time to start building your collection.
                            </Text>
                            <Text className="text-neutral-600 font-mono text-xs text-center mb-10">
                                {email}
                            </Text>
                            <Pressable
                                onPress={() => {
                                    if (router.canGoBack()) {
                                        router.back();
                                    } else {
                                        router.replace('/');
                                    }
                                }}
                                className="bg-amber-500 px-10 py-4 rounded-xl active:opacity-80"
                                style={{ shadowColor: '#f59e0b', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } }}
                            >
                                <Text
                                    className="text-neutral-950 font-bold text-lg"
                                    style={{ fontFamily: 'VCR_OSD_MONO' }}
                                >
                                    START TRACKING
                                </Text>
                            </Pressable>
                        </View>
                    ) : signUpSuccess ? (
                        <View className="flex-1 items-center justify-center py-16">
                            <FontAwesome name="envelope" size={48} color="#f59e0b" style={{ marginBottom: 24 }} />
                            <Text
                                className="text-white text-2xl font-bold mb-3 text-center"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                CHECK YOUR EMAIL
                            </Text>
                            <Text className="text-neutral-400 font-mono text-sm text-center leading-5 mb-2">
                                We sent a confirmation link to:
                            </Text>
                            <Text className="text-amber-500 font-mono text-sm text-center mb-8">
                                {email}
                            </Text>
                            <Text className="text-neutral-500 font-mono text-xs text-center leading-5 px-4">
                                Click the link in the email to verify your account, then come back and sign in.
                            </Text>
                            <Pressable
                                onPress={() => { setSignUpSuccess(false); setMode('signin'); }}
                                className="mt-10 bg-amber-500 px-8 py-3 rounded-lg"
                            >
                                <Text className="text-neutral-950 font-mono font-bold">BACK TO SIGN IN</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View className="space-y-4 gap-4">
                            <View>
                                <Text
                                    className="text-amber-500 text-xs mb-2 ml-1"
                                    style={{ fontFamily: 'VCR_OSD_MONO' }}
                                >
                                    EMAIL
                                </Text>
                                <TextInput
                                    nativeID="email-input"
                                    {...({ name: 'email' } as any)}
                                    className="bg-neutral-900 text-white px-4 py-3 rounded-lg font-mono border border-neutral-800 focus:border-amber-500"
                                    placeholder="email@example.com"
                                    placeholderTextColor="#666"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    keyboardType="email-address"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            <View>
                                <Text
                                    className="text-amber-500 text-xs mb-2 ml-1"
                                    style={{ fontFamily: 'VCR_OSD_MONO' }}
                                >
                                    PASSWORD
                                </Text>
                                <TextInput
                                    nativeID="password-input"
                                    {...({ name: 'password' } as any)}
                                    className="bg-neutral-900 text-white px-4 py-3 rounded-lg font-mono border border-neutral-800 focus:border-amber-500"
                                    placeholder="••••••••"
                                    placeholderTextColor="#666"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>

                            <Pressable
                                onPress={handleAuth}
                                disabled={loading}
                                className={`py-4 rounded-lg items-center mt-4 ${loading ? 'bg-neutral-800' : 'bg-amber-500'
                                    }`}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text
                                        className="text-neutral-950 font-bold text-lg"
                                        style={{ fontFamily: 'VCR_OSD_MONO' }}
                                    >
                                        {mode === 'signin' ? 'SIGN IN' : 'SIGN UP'}
                                    </Text>
                                )}
                            </Pressable>

                            {/* Inline error message */}
                            {errorMsg ? (
                                <View className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 mt-1">
                                    <Text className="text-red-400 font-mono text-xs text-center">{errorMsg}</Text>
                                </View>
                            ) : null}

                            <View className="flex-row justify-center mt-4">
                                <Text className="text-neutral-400 font-mono">
                                    {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                                </Text>
                                <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
                                    <Text className="text-amber-500 font-mono font-bold">
                                        {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
