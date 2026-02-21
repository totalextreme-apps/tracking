import { asyncStoragePersister, queryClient } from '@/lib/query-client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import '../global.css';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Dimensions, Platform, View } from 'react-native';
import 'react-native-reanimated';

import { DesktopBlocker } from '@/components/DesktopBlocker';
import { OnboardingModal } from '@/components/OnboardingModal';
import { StaticOverlay } from '@/components/StaticOverlay';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import { SoundProvider } from '@/context/SoundContext';
import { ThriftModeProvider } from '@/context/ThriftModeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Prevent splash screen from hiding early
SplashScreen.preventAutoHideAsync().catch(() => { });

export {
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => { });
    }
  }, [loaded, error]);

  return (
    <SettingsProvider>
      <SoundProvider>
        <AuthProvider>
          <ThriftModeProvider>
            <RootLayoutNav fontsLoaded={loaded} />
          </ThriftModeProvider>
        </AuthProvider>
      </SoundProvider>
    </SettingsProvider>
  );
}

function RootLayoutNav({ fontsLoaded }: { fontsLoaded: boolean }) {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const [showStatic, setShowStatic] = useState(false);
  const { staticEnabled, onboardingKey } = useSettings();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const checkViewport = () => {
      if (Platform.OS !== 'web') return;
      const { width } = Dimensions.get('window');
      const ua = navigator.userAgent;
      const isMobileUA = /iPhone|iPad|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsDesktop(!isMobileUA && !isIPad && width > 900);
    };

    checkViewport();
    const subscription = Dimensions.addEventListener('change', checkViewport);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (staticEnabled) {
      setShowStatic(true);
      const timer = setTimeout(() => setShowStatic(false), 400);
      return () => clearTimeout(timer);
    }
    setShowStatic(false);
  }, [pathname, staticEnabled]);

  // Handle Desktop Blocking on Web
  if (Platform.OS === 'web' && isMounted && isDesktop) {
    return <DesktopBlocker />;
  }

  // Final rendering shell
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            {fontsLoaded ? (
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="add" options={{ presentation: 'modal', headerShown: false }} />
                <Stack.Screen name="auth" options={{ presentation: 'modal', headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                <Stack.Screen name="movie/[id]" options={{ presentation: 'modal', headerShown: false }} />
              </Stack>
            ) : (
              <View style={{ flex: 1, backgroundColor: '#000' }} />
            )}
            <StaticOverlay visible={showStatic} />
            <OnboardingModal key={onboardingKey} />
          </View>
        </ThemeProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
