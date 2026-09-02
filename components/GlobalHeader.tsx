import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useNotifications } from '@/hooks/useSocial';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
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
    const { width } = useWindowDimensions();
    const { userId } = useAuth();
    const { data: profile } = useProfile(userId ?? null);
    const { data: notifications } = useNotifications(userId ?? undefined);

    const isDesktop = Platform.OS === 'web' && width >= 768;
    const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

    const isHome = pathname === '/' || pathname === '/(tabs)' || pathname === '/index';
    const isLists = pathname.includes('/lists');
    const isCommunity = pathname.includes('/community');
    const isSettings = pathname.includes('/settings');
    const isAbout = pathname.includes('/about');
    const isPrivacy = pathname.includes('/privacy');
    const isDeveloper = pathname.includes('/developer');
    const isAdd = pathname.includes('/add');
    const isCreateList = pathname.includes('/create-list');
    const isStackView = pathname.includes('/stack/');
    const isMovieDetail = pathname.includes('/movie/');

    const getDescriptor = () => {
        if (isHome) return thriftMode ? "Thrift Mode Activated" : "My Stacks";
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
        if (value && !isHome) {
            router.push('/');
        }
    };

    const navItems = [
        { label: 'MY STACKS', path: '/', active: isHome, icon: 'film' },
        { label: 'CURATED', path: '/lists', active: isLists, icon: 'list-ul' },
        { label: 'COMMUNITY', path: '/community', active: isCommunity, icon: 'users', badge: unreadCount },
        { label: profile?.username?.toUpperCase() || 'PROFILE', path: '/settings', active: isSettings, icon: 'user' },
    ];

    return (
        <View
            style={[
                styles.container,
                { paddingTop: isDesktop ? 12 : Math.max(insets.top, 16) }
            ]}
            className="bg-neutral-950 border-b border-neutral-900"
        >
            <View
                style={[
                    styles.innerContainer,
                    isDesktop
                        ? { maxWidth: 1400, width: '100%', alignSelf: 'center', paddingHorizontal: 32 }
                        : { paddingHorizontal: 16 }
                ]}
            >
                {/* Logo & Descriptor */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
                    <Pressable onPress={() => { playSound('click'); router.push('/'); }}>
                        <Image
                            source={logoSource}
                            style={{ width: isDesktop ? 160 : 140, height: isDesktop ? 50 : 44, maxWidth: '100%', flexShrink: 1 }}
                            resizeMode="contain"
                        />
                    </Pressable>
                    {!isDesktop && (
                        <Text
                            className="text-amber-500/70 text-[8px] uppercase tracking-[2px] mt-1 ml-1"
                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                            numberOfLines={1}
                        >
                            {getDescriptor()}
                        </Text>
                    )}
                </View>

                {/* Desktop Navigation Tabs */}
                {isDesktop && (
                    <View className="flex-row items-center gap-2 mx-6">
                        {navItems.map((item) => (
                            <Pressable
                                key={item.path}
                                onPress={() => {
                                    playSound('click');
                                    router.push(item.path as any);
                                }}
                                className={`flex-row items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                                    item.active
                                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                        : 'bg-transparent border-transparent hover:bg-neutral-900 text-neutral-400'
                                }`}
                            >
                                <FontAwesome
                                    name={item.icon as any}
                                    size={13}
                                    color={item.active ? '#f59e0b' : '#737373'}
                                />
                                <Text
                                    style={{ fontFamily: 'SpaceMono' }}
                                    className={`text-xs font-bold tracking-wider ${
                                        item.active ? 'text-amber-400' : 'text-neutral-400'
                                    }`}
                                >
                                    {item.label}
                                </Text>
                                {item.badge && item.badge > 0 ? (
                                    <View className="bg-amber-500 px-1.5 py-0.5 rounded-full">
                                        <Text className="text-[9px] font-bold text-black font-mono">
                                            {item.badge}
                                        </Text>
                                    </View>
                                ) : null}
                            </Pressable>
                        ))}

                        <Pressable
                            onPress={() => { playSound('click'); router.push('/add'); }}
                            className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg border bg-neutral-900 border-amber-500/30 hover:border-amber-500 ${
                                isAdd ? 'border-amber-500 bg-amber-500/10' : ''
                            }`}
                        >
                            <FontAwesome name="plus" size={12} color="#f59e0b" />
                            <Text
                                style={{ fontFamily: 'SpaceMono' }}
                                className="text-xs font-bold text-amber-400 tracking-wider"
                            >
                                ADD TITLE
                            </Text>
                        </Pressable>
                    </View>
                )}

                {/* Right controls */}
                {isDesktop ? (
                    <View className="flex-row items-center gap-4 ml-auto flex-shrink-0">
                        <View className="flex-row items-center gap-2 bg-neutral-900/60 px-3 py-1.5 rounded-lg border border-neutral-800/80">
                            <Text
                                className="text-neutral-400 text-[10px] tracking-widest font-mono"
                                style={{ fontFamily: 'VCR_OSD_MONO' }}
                            >
                                THRIFT MODE
                            </Text>
                            <Switch
                                value={thriftMode}
                                onValueChange={handleToggleThrift}
                                trackColor={{ false: '#262626', true: '#059669' }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>
                ) : (
                    isHome && (
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
                    )
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        zIndex: 100,
    },
    innerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
    },
});
