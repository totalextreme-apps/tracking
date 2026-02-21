import { asyncStoragePersister, queryClient } from '@/lib/query-client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import '../global.css';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
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

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) {
      console.error('Font Load Error:', error);
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => { });
    }
  }, [loaded]);

  if (!loaded) {
    // Return a black screen during font loading to avoid white flash
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  return (
    <SettingsProvider>
      <RootLayoutNav />
    </SettingsProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const [showStatic, setShowStatic] = useState(false);
  const { staticEnabled, onboardingKey } = useSettings();
  const { width } = useWindowDimensions();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const checkIsDesktop = () => {
      if (Platform.OS !== 'web') return false;
      const ua = navigator.userAgent;
      const isMobileUA = /iPhone|iPad|iPod|Android|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return !isMobileUA && !isIPad && window.innerWidth > 900;
    };

    setIsDesktop(checkIsDesktop());
  }, [width]);

  useEffect(() => {
    // Trigger static on route change IF enabled
    if (staticEnabled) {
      setShowStatic(true);
      const timer = setTimeout(() => {
        setShowStatic(false);
      }, 400); // 400ms static burst
      return () => clearTimeout(timer);
    } else {
      setShowStatic(false);
    }
  }, [pathname, staticEnabled]);

  // If we are on desktop web, show the blocker
  if (Platform.OS === 'web' && isMounted && isDesktop) {
    return <DesktopBlocker />;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <SoundProvider>
        <AuthProvider>
          <ThriftModeProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="add" options={{ presentation: 'modal', headerShown: false }} />
                  <Stack.Screen name="auth" options={{ presentation: 'modal', headerShown: false }} />
                  <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="movie/[id]" options={{ presentation: 'modal', headerShown: false }} />
                </Stack>
                <StaticOverlay visible={showStatic} />
                <OnboardingModal key={onboardingKey} />
              </ThemeProvider>
            </GestureHandlerRootView>
          </ThriftModeProvider>
        </AuthProvider>
      </SoundProvider>
    </PersistQueryClientProvider>
  );
}
