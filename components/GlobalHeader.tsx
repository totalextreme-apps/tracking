import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const logoSource = Platform.OS === 'web'
    ? { uri: '/logo_tracking.png' }
    : require('@/assets/images/logo_tracking.png');

export function GlobalHeader() {
    const router = useRouter();
    const pathname = usePathname();
    const { thriftMode, setThriftMode } = useThriftMode();
    const { playSound } = useSound();
    const insets = useSafeAreaInsets();

    const isHome = pathname === '/' || pathname === '/(tabs)';
    const isSettings = pathname === '/two' || pathname === '/(tabs)/two';
    const isAbout = pathname === '/about' || pathname === '/(tabs)/about';
    const isPrivacy = pathname === '/privacy' || pathname === '/(tabs)/privacy';
    const isDeveloper = pathname === '/developer' || pathname === '/(tabs)/developer';
    const isAdd = pathname === '/add' || pathname === '/(tabs)/add';
    const isLists = pathname === '/lists' || pathname === '/(tabs)/lists';
    const isCreateList = pathname === '/create-list' || pathname === '/(tabs)/create-list';
    const isStackView = pathname.startsWith('/stack/') || pathname.startsWith('/(tabs)/stack/');
    const isMovieDetail = pathname.startsWith('/movie/') || pathname.startsWith('/(tabs)/movie/');

    const getDescriptor = () => {
        if (isHome) {
            return thriftMode ? "Thrift Mode Activated" : "My Stacks";
        }
        if (isSettings) return "Settings";
        if (isAbout) return "About Tracking";
        if (isPrivacy) return "Privacy Policy";
        if (isDeveloper) return "The Developer";
        if (isAdd) return "Add Movie";
        if (isLists) return "Curated Stacks";
        if (isCreateList) return "Create List";
        if (isStackView) return "Curated Stack";
        if (isMovieDetail) return "Movie Details";
        return "";
    };

    const handleToggleThrift = (value: boolean) => {
        playSound('tv_off');
        setThriftMode(value);
    };

    return (
        <View
            style={[
                styles.container,
                { paddingTop: Math.max(insets.top, 20) }
            ]}
            className="bg-neutral-950 border-b border-neutral-900"
        >
            <View className="flex-row items-center justify-between px-8 pb-4">
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Pressable onPress={() => { playSound('click'); router.push('/'); }}>
                        <Image
                            source={logoSource}
                            style={{ width: 182, height: 60, maxWidth: '100%', flexShrink: 1 }}
                            resizeMode="contain"
                        />
                    </Pressable>
                    <Text
                        className="text-amber-500/70 text-[8px] uppercase tracking-[2px] mt-1 ml-1"
                        style={{ fontFamily: 'VCR_OSD_MONO' }}
                    >
                        {getDescriptor()}
                    </Text>
                </View>

                {isHome && (
                    <View className="flex-row items-center gap-3 ml-2 flex-shrink-0">
                        <Pressable
                            onPress={() => { playSound('click'); router.push('/add'); }}
                            className="bg-neutral-900 p-2 rounded-lg border border-neutral-800"
                            hitSlop={10}
                        >
                            <FontAwesome name="plus" size={18} color="#f59e0b" />
                        </Pressable>

                        <View className="flex-row items-center gap-2">
                            <Text
                                className="text-neutral-500 text-[10px] tracking-widest"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                THRIFT
                            </Text>
                            <Switch
                                value={thriftMode}
                                onValueChange={handleToggleThrift}
                                trackColor={{ false: '#262626', true: '#059669' }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        zIndex: 100,
    }
});
