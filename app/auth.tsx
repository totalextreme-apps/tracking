import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
    const insets = useSafeAreaInsets();
    useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');

    async function handleAuth() {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setLoading(true);
        Keyboard.dismiss();

        try {
            if (mode === 'signup') {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                if (data.session) {
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace('/');
                    }
                } else {
                    Alert.alert('Check your email', 'Please check your inbox for email verification!');
                }
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
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
        } catch (error) {
            if (error instanceof Error) {
                Alert.alert(mode === 'signup' ? 'Sign Up Failed' : 'Sign In Failed', error.message);
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-neutral-950"
        >
            <TouchableWithoutFeedback onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
                <View className="flex-1 justify-center px-8" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
                    <View className="mb-8">
                        <Text className="text-white font-mono text-3xl font-bold mb-2 tracking-tighter">
                            {mode === 'signin' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
                        </Text>
                        <Text className="text-neutral-400 font-mono text-sm">
                            {mode === 'signin'
                                ? 'Enter your credentials to access your collection.'
                                : 'Sign up to sync your collection across devices.'}
                        </Text>
                    </View>

                    <View className="space-y-4 gap-4">
                        <View>
                            <Text className="text-amber-500 font-mono text-xs mb-2 ml-1">EMAIL</Text>
                            <TextInput
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
                            <Text className="text-amber-500 font-mono text-xs mb-2 ml-1">PASSWORD</Text>
                            <TextInput
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
                                <Text className="text-neutral-950 font-bold font-mono text-lg">
                                    {mode === 'signin' ? 'SIGN IN' : 'SIGN UP'}
                                </Text>
                            )}
                        </Pressable>

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

                    <Pressable
                        className="mt-12 items-center"
                        onPress={() => router.back()}
                    >
                        <Text className="text-neutral-500 font-mono text-xs">CANCEL</Text>
                    </Pressable>
                </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}
